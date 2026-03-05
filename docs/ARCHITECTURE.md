# Architecture — Local File Gallery

## Overview
로컬 네트워크에서 특정 폴더의 파일을 웹 브라우저로 열람하는 갤러리 앱.

## Stack
- **Server**: Node.js + Express 5
- **Frontend**: Vanilla HTML / CSS / JS
- **Image Processing**: Sharp (thumbnails)
- **mDNS**: bonjour-service (`.local` 도메인 광고)

## Server API
| Endpoint | Description |
|----------|-------------|
| `GET /api/files?path=` | 디렉토리 내 파일/폴더 목록 (isFavorite 플래그 포함) |
| `GET /api/thumbnail?path=&size=` | 이미지 썸네일 (JPEG) |
| `GET /api/file?path=` | 파일 스트리밍 (Range 지원) |
| `GET /api/favorites` | 즐겨찾기 목록 (유효한 파일만) |
| `POST /api/favorites` | 즐겨찾기 토글 `{ path, action? }` |

## Network Access
- **mDNS**: `http://gallery.local:3005` (같은 네트워크 내 자동 발견)
- 환경변수 `MDNS_NAME`으로 이름 변경 가능

## Security
- Path traversal 방지: `GALLERY_ROOT` 외부 접근 차단
- 숨김 파일(`.`으로 시작) 제외

## Usage
```bash
GALLERY_ROOT=/path/to/folder npm start
```

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| ← → | 이전/다음 파일 |
| Esc | 라이트박스 닫기 |
| F | 전체화면 토글 |
| Space | 동영상 재생/일시정지 |

## Touch / Gesture Controls (Quest 3 지원)
| Gesture | Gallery Mode | Lightbox Mode |
|---------|-------------|---------------|
| ← → 스와이프 | - | 이전/다음 사진 (슬라이드 애니메이션) |
| ↓ 스와이프 | - | 라이트박스 닫기 (갤러리 복귀) |
| ↑ 스와이프 | - | ⭐ 즐겨찾기 토글 |
| 롱프레스 (500ms) | - | 2x 줌 토글 (프레스 위치 기준) |
| 더블 탭 | - | 전체화면 진입/해제 (즉시 반응) |
| 드래그 | - | 확대 시 패닝 / 스와이프 방향 피드백 |

