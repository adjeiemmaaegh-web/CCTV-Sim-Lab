# Stage 16 acceptance record (2026-11-15)

Status: **development-verified, NO-GO for production.** Environment: Windows 11, Node 24.19, npm 11.17, Playwright Chromium (headless).

## Verified (executed, with results)

| Gate | Result | Evidence |
|---|---|---|
| Dependency install + lockfile | PASS | `package-lock.json` committed; 0 vulnerabilities reported by npm |
| Reproducible install | PASS | `rm -rf node_modules && npm ci` |
| Strict TypeScript | PASS | `npm run check` |
| Production build + PWA files | PASS | `npm run build` -> `dist-react/` index.html, hashed JS/CSS, manifest, service-worker.js (5 precache files) |
| Unit/engine tests | PASS 48/48 | `npm test`. Covers SHA-256 vectors, file round-trip/tamper/oversize/legacy/checkpoint bounds, all ten scenarios (create/simulate/evaluate/assess), no-free-marks, assisted-cap on assessment, and **engine-level full completion** of home4, home8, shop3, warehouse8, diagnose4 (CCTV), alarm-install, perimeter (alarm), ip-network (built from scratch: VLAN trunk, DHCP lease, inter-VLAN route), rfid-access (grant/deny/exit, revocation removes evidence), solar-backup (mains outage on battery) |
| Browser end-to-end | PASS 16/16 | `npm run test:e2e` (Playwright, real Chromium on localhost): startup with zero console errors; service worker controls the page and **the app reloads fully offline**; all ten scenarios selectable; every console tab renders for every scenario; device placement; undo/redo; keyboard select + arrow nudge; topology/zoom/fit; Save As download fallback labelled unverified; corrupt checksum rejected |
| File persistence (browser FS API) | PASS 5/5 | Playwright with a picker **test double** returning genuine origin-private-FS handles: Save As, Save -> revision 2 + checkpoint, Save As onto nonempty file refused with bytes unchanged, external modification blocks overwrite, Open reloads with revision, corrupt file rejected |
| Accessibility (automated) | PASS | axe-core WCAG 2 A/AA: no serious/critical violations on the main workstation (default scenario). Not a substitute for manual audit |

## Defects found and fixed this stage

1. **Canvas unusable on 1280x720 laptops** (floor-plan area squeezed to ~65 px and covered by the console). Fixed in `workstation.css`: minimum main-grid height, workstation scrolls vertically. Regression test included.
2. Vite chunk-size warning (573 kB): raised `chunkSizeWarningLimit` to 700 kB. Offline-first app precaches the whole shell, so splitting gives no benefit; documented rather than hidden.

## Not verified (external acceptance gates, remain open)

- Real OS file-picker writes to physical disk (headless cannot drive native dialogs; the test double uses real FS handles but not the OS picker).
- Installable-PWA UX, restart-after-browser-close offline, update-over-unsaved-edits flow in a headed browser.
- Firefox / Safari / Edge; touch devices.
- 8 GB Windows integrated-graphics performance benchmark.
- Manual accessibility audit (screen reader), reduced-motion and high-contrast review.
- Manual pointer drag/resize of rooms and walls (only click-placement and keyboard moves are automated).
- Expert review of technical accuracy by qualified installers/instructors; no real-device interoperability is claimed.
- GitHub Actions run on the hosted runner (workflow committed; result recorded in the PR/commit status).

No deployment, release or paid-service action has been taken. Do not describe as production-ready.
