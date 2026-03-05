const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const sharp = require('sharp');
const mime = require('mime-types');
const os = require('os');
const { Bonjour } = require('bonjour-service');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const GALLERY_ROOT = path.resolve(process.env.GALLERY_ROOT || path.join(os.homedir(), 'Pictures'));
const PASSWORD = process.env.GALLERY_PASSWORD || '3319';

// ─── Favorites storage ───
const GALLERY_META_DIR = path.join(GALLERY_ROOT, '.gallery');
const FAVORITES_FILE = path.join(GALLERY_META_DIR, 'favorites.json');

// ─── Middleware ───
app.use(express.json());

// ─── Security: prevent path traversal ───
function safePath(requestedPath) {
  const resolved = path.resolve(GALLERY_ROOT, requestedPath || '');
  if (!resolved.startsWith(GALLERY_ROOT)) {
    return null;
  }
  return resolved;
}

// ─── Auth: simple session-based auth ───
const activeSessions = new Set();

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Auth endpoint ───
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    const token = generateToken();
    activeSessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(403).json({ error: 'Wrong password' });
  }
});

// ─── Favorites utilities ───
async function ensureMetaDir() {
  try { await fsp.mkdir(GALLERY_META_DIR, { recursive: true }); } catch { /* exists */ }
}

async function loadFavorites() {
  try {
    const data = await fsp.readFile(FAVORITES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function saveFavorites(items) {
  await ensureMetaDir();
  await fsp.writeFile(FAVORITES_FILE, JSON.stringify({ version: 1, items }, null, 2), 'utf-8');
}

async function cleanupFavorites() {
  const items = await loadFavorites();
  if (items.length === 0) return;
  const valid = [];
  for (const item of items) {
    const fullPath = path.resolve(GALLERY_ROOT, item.path);
    try {
      await fsp.access(fullPath);
      valid.push(item);
    } catch {
      console.log(`[Favorites] Removed stale: ${item.path}`);
    }
  }
  if (valid.length !== items.length) {
    await saveFavorites(valid);
    console.log(`[Favorites] Cleanup: ${items.length} → ${valid.length} items`);
  }
}

// ─── Static files (login page — no auth needed, no cache in dev) ───
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
}));

// ─── API: List files in directory ───
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    const fullPath = safePath(requestedPath);

    if (!fullPath) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stat = await fsp.stat(fullPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    const entries = await fsp.readdir(fullPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) continue;

      const entryPath = path.join(fullPath, entry.name);
      const relativePath = path.relative(GALLERY_ROOT, entryPath);

      try {
        const entryStat = await fsp.stat(entryPath);
        const mimeType = entry.isDirectory() ? 'directory' : (mime.lookup(entry.name) || 'application/octet-stream');
        const category = getCategory(mimeType, entry.isDirectory());

        files.push({
          name: entry.name,
          path: relativePath,
          isDirectory: entry.isDirectory(),
          size: entryStat.size,
          modified: entryStat.mtime,
          mime: mimeType,
          category,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    // Attach favorite flags
    const favItems = await loadFavorites();
    const favSet = new Set(favItems.map(f => f.path));
    for (const file of files) {
      file.isFavorite = favSet.has(file.path);
    }

    // Sort: directories first, then by name  
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json({
      currentPath: requestedPath,
      rootName: path.basename(GALLERY_ROOT),
      files,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Thumbnail generation ───
app.get('/api/thumbnail', requireAuth, async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    const fullPath = safePath(requestedPath);
    const size = parseInt(req.query.size) || 400;

    if (!fullPath) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const mimeType = mime.lookup(fullPath) || '';
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Not an image' });
    }

    // Generate thumbnail with sharp
    const thumbnail = await sharp(fullPath)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(thumbnail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Serve file (with Range support for video) ───
app.get('/api/file', requireAuth, async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    const fullPath = safePath(requestedPath);

    if (!fullPath) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let stat;
    try {
      stat = await fsp.stat(fullPath);
    } catch (e) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot serve directory' });
    }

    const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
    const fileSize = stat.size;

    // Range request support (for video seeking)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      const stream = fs.createReadStream(fullPath);
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    }
  } catch (err) {
    console.error('File serve error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ─── API: Favorites ───
app.get('/api/favorites', requireAuth, async (req, res) => {
  try {
    const items = await loadFavorites();
    // Validate: only return items that still exist
    const valid = [];
    for (const item of items) {
      const fullPath = path.resolve(GALLERY_ROOT, item.path);
      try {
        const stat = await fsp.stat(fullPath);
        const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
        valid.push({
          ...item,
          name: path.basename(item.path),
          size: stat.size,
          modified: stat.mtime,
          mime: mimeType,
          category: getCategory(mimeType, false),
          isDirectory: false,
          isFavorite: true,
        });
      } catch {
        // File no longer exists — skip
      }
    }
    res.json({ items: valid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/favorites', requireAuth, async (req, res) => {
  try {
    const { path: filePath, action } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });

    // Validate path safety
    const fullPath = safePath(filePath);
    if (!fullPath) return res.status(403).json({ error: 'Access denied' });

    const items = await loadFavorites();
    const existingIndex = items.findIndex(item => item.path === filePath);

    if (action === 'add') {
      if (existingIndex === -1) {
        items.push({ path: filePath, addedAt: new Date().toISOString() });
      }
    } else if (action === 'remove') {
      if (existingIndex !== -1) {
        items.splice(existingIndex, 1);
      }
    } else {
      // Toggle
      if (existingIndex !== -1) {
        items.splice(existingIndex, 1);
      } else {
        items.push({ path: filePath, addedAt: new Date().toISOString() });
      }
    }

    await saveFavorites(items);
    const isFavorite = items.some(item => item.path === filePath);
    res.json({ success: true, isFavorite });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ───
function getCategory(mimeType, isDir) {
  if (isDir) return 'folder';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'file';
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// ─── mDNS (Bonjour) ───
const MDNS_NAME = process.env.MDNS_NAME || 'gallery';
const bonjour = new Bonjour();

// ─── Start server ───
app.listen(PORT, '0.0.0.0', async () => {
  // Cleanup stale favorites on startup
  await cleanupFavorites();

  // Advertise via mDNS
  bonjour.publish({ name: MDNS_NAME, type: 'http', port: Number(PORT), host: `${MDNS_NAME}.local` });

  const ips = getLocalIPs();
  const lanUrl = ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`;

  // Big ASCII digits for VR passthrough readability
  const bigDigits = {
    '0': ['█████', '█   █', '█   █', '█   █', '█████'],
    '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
    '2': ['█████', '    █', '█████', '█    ', '█████'],
    '3': ['█████', '    █', '█████', '    █', '█████'],
    '4': ['█   █', '█   █', '█████', '    █', '    █'],
    '5': ['█████', '█    ', '█████', '    █', '█████'],
    '6': ['█████', '█    ', '█████', '█   █', '█████'],
    '7': ['█████', '    █', '   █ ', '  █  ', '  █  '],
    '8': ['█████', '█   █', '█████', '█   █', '█████'],
    '9': ['█████', '█   █', '█████', '    █', '█████'],
    '.': ['     ', '     ', '     ', '     ', '  █  '],
    ':': ['     ', '  █  ', '     ', '  █  ', '     '],
  };

  function toBigText(str) {
    const chars = str.split('').map(c => bigDigits[c] || ['     ', '     ', '     ', '     ', '     ']);
    return Array.from({ length: 5 }, (_, row) =>
      chars.map(c => c[row]).join(' ')
    ).join('\n');
  }

  // Extract IP and port for big display
  const ipStr = ips[0] || 'localhost';
  const bigIP = toBigText(ipStr);
  const bigPort = toBigText(String(PORT));

  console.log('\n');
  console.log('  📁  L O C A L   F I L E   G A L L E R Y');
  console.log('  ─'.repeat(25));
  console.log('');
  console.log('  🌐 IP Address:');
  console.log('');
  bigIP.split('\n').forEach(line => console.log(`    ${line}`));
  console.log('');
  console.log('  🔌 Port:');
  console.log('');
  bigPort.split('\n').forEach(line => console.log(`    ${line}`));
  console.log('');
  console.log('  ─'.repeat(25));
  console.log(`  URL:      ${lanUrl}`);
  console.log(`  mDNS:     http://${MDNS_NAME}.local:${PORT}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Root:     ${GALLERY_ROOT}`);
  console.log('  ─'.repeat(25));
  console.log('  Press Ctrl+C to stop\n');
});

// ─── Graceful shutdown ───
process.on('SIGINT', () => {
  console.log('\n🛑 서버 종료 중... mDNS 해제');
  bonjour.unpublishAll();
  bonjour.destroy();
  process.exit(0);
});
