# 🎨 Gallery VR

## Tagline-en

Stream your photos and videos from your computer to any device — phone, tablet, or VR headset — over Wi-Fi. No cloud, no complicated setup, just open a browser and you're in.

## Tagline-ko

컴퓨터에 쌓인 사진과 영상을, 스마트폰·태블릿·VR 헤드셋으로 클라우드 없이 바로 감상하세요. Wi-Fi만 연결하면 끝 — 어려운 설정도, 업로드도 필요이 순식간에.

## Tagline-ja

パソコンの写真や動画を、スマホ・タブレット・VRヘッドセットでそのまま楽しめます。クラウド不要、面倒な設定も不要 — Wi-Fiに繋いで、ブラウザを開くだけ。

---

## Summary-en

Ever wanted to browse your photo library on a bigger screen — or better yet, in VR — without uploading anything to the cloud? Gallery VR turns your computer into a personal media server that any device on your Wi-Fi can access instantly. Just open a browser on your phone, tablet, or Meta Quest 3, and your entire library is there — swipe through images, enjoy immersive fullscreen slideshows, and mark your favorites across all devices. No accounts, no subscriptions, no data leaving your home.

## Summary-ko

컴퓨터에 쌓여 있는 사진과 영상, 매번 USB로 옮기거나 클라우드에 올리기 번거로우셨죠?
Gallery VR은 같은 Wi-Fi로만 연결되어 있다면, 스마트폰·태블릿·Meta Quest 3 VR 헤드셋 등에서 바로 사진과 영상을 감상할 수 있습니다. 번거로운 설정도 없고, 내 파일은 안전하게 보관됩니다.

## Summary-ja

パソコンにある写真や動画、見るたびにUSBやクラウドにアップするのは面倒ですよね。Gallery VRなら同じWi-Fiに繋がっていれば、スマホ・タブレット・Meta Quest 3 VRヘッドセットのブラウザからすぐにアクセスできます。スワイプで写真を切り替え、フルスクリーンのスライドショーで没入し、お気に入りはすべてのデバイスで自動同期。アカウント不要、サブスク不要、あなたのファイルが外に出ることはありません。

---

## ✨ What It Does

- **Browse your entire library from any device** — Open a browser on your phone, tablet, or VR headset and access all photos and videos on your computer.
- **Immerse in fullscreen slideshows** — Scroll through photos in an edge-to-edge card view with auto-play and adjustable intervals.
- **Navigate with VR-friendly gestures** — Swipe, double-tap, and triple-tap — every gesture is fine-tuned for Meta Quest 3 hand tracking.
- **Sync favorites across devices** — Star an image on your phone, and it shows up on your Quest and desktop too.
- **Auto-discover on your network** — mDNS (Bonjour) lets Apple devices find the server by name — no IP address needed.
- **Preview images, videos, and PDFs** — Thumbnails are auto-generated for fast browsing, with full preview for media and documents.
- **Protect with a password** — Set a simple access code to keep your gallery private on shared networks.
- **Switch between dark and light themes** — Comfortable viewing in any environment, from a bright room to a dark VR session.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (v18+) |
| Server | Express.js 5 |
| Image Processing | Sharp (auto-thumbnails) |
| Network Discovery | Bonjour (mDNS) |
| Frontend | Vanilla JS + CSS (no frameworks) |
| Storage | JSON file-based favorites |

---

## 📦 Installation

### macOS (easiest)

1. Download this project → click the green **Code** button on GitHub → **Download ZIP**
2. Unzip the folder
3. Double-click **`start.command`** — the server starts automatically
4. Open `http://localhost:3005` in your browser

### Any platform (terminal)

```bash
git clone https://github.com/hsu3046/GalleryVR.git
cd GalleryVR
npm install
cp .env.example .env.local   # Edit gallery path and password
npm start
```

### Accessing from other devices

Once running, open a browser on your phone / tablet / VR headset and enter the **IP address** shown in the terminal (e.g. `http://192.168.0.15:3005`).

> **Tip:** On macOS, other Apple devices can also use `http://gallery.local:3005`.

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GALLERY_ROOT` | `~/Pictures` | Root folder for the gallery |
| `GALLERY_PASSWORD` | `3319` | Access password |
| `PORT` | `3000` | Server port |
| `MDNS_NAME` | `gallery` | mDNS hostname (`http://<name>.local:<port>`) |

On first launch, the app will ask you to enter or drag-and-drop a folder path. This is saved to `config.json` for future launches.

```bash
# Re-select the gallery folder
node server.js --reset
```

---

## 📁 Project Structure

```
├── server.js           # Express server, API routes, thumbnail generation
├── start.command        # macOS one-click launcher
├── config.json          # Saved gallery root path
├── package.json         # Dependencies and scripts
├── .env.example         # Environment variable template
├── LICENSE              # GNU GPL v3
├── public/              # Frontend (served as static files)
│   ├── index.html       #   Main HTML structure
│   ├── app.js           #   Application logic, gestures, UI
│   └── styles.css       #   All styling and themes
└── docs/                # Project documentation
    ├── ARCHITECTURE.md  #   System architecture overview
    └── MEMORY.md        #   AI context memory
```

---

## 🗺 Roadmap

- [ ] Multiple slideshow modes (crossfade, ken burns, random shuffle)
- [ ] Enhanced video playback (streaming, seek preview, subtitle support)
- [ ] VR-exclusive features (spatial gallery view, hand gesture shortcuts)
- [ ] Folder-level thumbnails for quicker navigation
- [ ] Multi-language UI (EN / KO / JA)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat(scope): add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

---

*Built by [KnowAI](https://knowai.space) · © 2026 KnowAI*
