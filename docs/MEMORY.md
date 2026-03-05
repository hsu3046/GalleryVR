# Project Memory

**Last Updated:** 2026-03-05

## Critical Issues & Solutions

### 2026-03-05: Meta Quest 3 — mDNS `.local` 도메인 미지원
- **Problem:** `http://gallery.local` 주소가 Quest 3 브라우저에서 접속 불가
- **Root Cause:** Android 기반 Chromium은 Bonjour/mDNS `.local` 도메인을 OS 레벨에서 해석 불가 (macOS/iOS만 지원)
- **Solution:** 서버 시작 시 LAN IP를 ASCII 큰 글자로 터미널에 표시 → Quest 패스스루로 읽고 직접 입력
- **Prevention:** Quest 3 관련 네트워크 기능은 항상 IP 직접 입력을 기본 경로로 설계

### 2026-03-05: 싱글 탭/더블 탭 타이밍 충돌 (VR)
- **Problem:** 싱글 탭(줌) vs 더블 탭(전체화면) 구분을 위한 350ms `setTimeout`이 VR에서 심각한 조작 미스 유발
- **Root Cause:** Quest 핸드트래킹의 핀치 제스처는 정밀도가 낮아, 탭 타이밍 기반 구분이 부정확
- **Solution:** 싱글 탭 제거 → 더블 탭(전체화면, 즉시 반응) + 롱프레스 500ms(줌) 분리
- **Prevention:** VR 제스처 설계 시 **타이밍 기반 구분 금지**. 서로 다른 제스처 유형으로 분리

### 2026-03-04: 브라우저 캐시로 인한 JS 변경 미반영
- **Problem:** `app.js` 수정 후 브라우저 새로고침해도 이전 코드 실행
- **Root Cause:** Express 정적 파일 서빙의 기본 ETag/Last-Modified 캐싱
- **Solution:** `express.static` 옵션에 `etag: false, lastModified: false, Cache-Control: no-store` 적용
- **Prevention:** 로컬 개발용 서버에서는 항상 캐시 비활성화

## Important Decisions

### Decision: Spatial View — Multi-Window Launcher 방식 채택
- **Date:** 2026-03-05
- **Options:** A) CSS Grid 뷰 (한 화면에 여러 이미지), B) A-Frame WebXR 3D 갤러리, C) `window.open()` 멀티 윈도우
- **Chosen:** C) `window.open()` 멀티 윈도우
- **Reasoning:** Quest 3의 Spatial Locking과 조합하면 각 이미지를 물리 공간에 독립 배치 가능. 서버 변경 없이 프론트엔드만으로 구현
- **Trade-offs:** 팝업 차단기에 의해 첫 번째 창만 열릴 수 있음 → 사용자 클릭 컨텍스트에서 호출 필수. Quest 3에서 최대 12창, 앱에서 6개로 제한

### Decision: 즐겨찾기 저장을 서버 JSON 파일로
- **Date:** 2026-03-05
- **Options:** A) 서버 JSON (`GALLERY_ROOT/.gallery/favorites.json`), B) localStorage, C) 하이브리드
- **Chosen:** A) 서버 JSON
- **Reasoning:** Quest 3, 폰, PC 등 멀티 디바이스에서 동일한 즐겨찾기 공유. 구현 단순
- **Trade-offs:** 파일 이동/삭제 시 stale 경로 발생 → Lazy Validation + 서버 시작 시 Auto-Cleanup으로 해결

### Decision: 즐겨찾기 아이콘을 ⭐ 별로 통일
- **Date:** 2026-03-05
- **Reasoning:** 하트보다 별이 "즐겨찾기/북마크" 의미에 더 범용적

### Decision: 줌을 롱프레스(500ms)로 변경
- **Date:** 2026-03-05
- **Options:** A) 싱글 탭(기존), B) 더블 탭, C) 롱프레스, D) 줌 제거
- **Chosen:** C) 롱프레스 500ms
- **Reasoning:** VR에서 핀치 유지가 자연스럽고, 더블 탭(전체화면)과 제스처 유형이 완전히 다름 → 충돌 제로

## Recurring Patterns

### Pattern: Quest 3 VR 브라우저 제약
- **Context:** Quest 브라우저는 Chromium 기반이지만 다음이 제한됨
  - mDNS `.local` 도메인 미지원
  - 수직 스와이프 → 브라우저 스크롤과 충돌 (라이트박스 모드에서는 `touchmove preventDefault`로 해결)
  - 멀티터치(핀치 줌) → 브라우저 자체 줌으로 가로채, 웹에 전달 안 됨
  - 핸드트래킹 정밀도 낮음 → 타이밍 기반 제스처 구분 피해야 함
  - Spatial Locking API는 **브라우저 JS에서 접근 불가** — 사용자 수동 앵커만 가능
  - `window.open()` 동작하지만 팝업 차단기 주의 → 사용자 클릭 이벤트 컨텍스트에서만 호출
- **Fix:** 모든 제스처를 `PointerEvent` 기반으로 통일하고, 제스처 유형(탭/홀드/스와이프)으로 분리

### Pattern: SVG viewBox 내 stroke 잘림
- **Occurrences:** 2회 (2026-03-05, Spatial View 아이콘)
- **Context:** `viewBox="0 0 24 24"`에서 좌표가 `y=0`까지 가면 `stroke-width: 2`의 상단 1px이 잘림
- **Fix:** 아이콘 좌표를 stroke-width 반값(1px) 이상 여유를 두고 배치. 최소 `y=2` 이상 시작

## Failed Attempts

### Tried: 수직 스와이프(↑)로 상위 폴더 이동
- **Why it failed:** 브라우저 2D 모드에서 수직 스와이프가 브라우저 스크롤과 충돌
- **Alternative used:** 라이트박스 모드에서만 수직 스와이프 활성화 (↓ 닫기, ↑ 즐겨찾기)
