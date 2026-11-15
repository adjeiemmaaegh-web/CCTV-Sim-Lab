# Stage 16 acceptance record (2026-11-15)

Status: **NO-GO for production.** Development verification only.

| Gate | Result | Evidence |
|---|---|---|
| Dependency install + lockfile | PASS | `npm install` generated `package-lock.json`; 0 vulnerabilities reported |
| Reproducible install | PASS | `rm -rf node_modules && npm ci` succeeded (Node 24.19, npm 11.17) |
| Strict TypeScript | PASS | `npm run check` exit 0 |
| Production build + PWA files | PASS | `npm run build`: `dist-react/` has index.html, hashed JS/CSS, manifest, service-worker.js (5 precache files). Warning: JS chunk 573 kB (>500 kB) |
| Automated tests | PASS 30/30 | `npm test` (vitest): sha256 vectors, 10 scenario create/simulate/evaluate/assess, assisted examples, empty-start-not-full-marks, file round-trip, tamper/invalid/oversize rejection, legacy raw import, checkpoint bound |
| React startup on localhost | PASS | `npm run preview` at 127.0.0.1:4173 in the app's built-in browser: workstation renders (catalogue, canvas, inspector, console, 10-scenario selector); no uncaught module errors |
| Service worker registration | BLOCKED | The embedded browser refused registration ("unknown error fetching script") although `/service-worker.js` returns 200 text/javascript. Needs real Chrome/Edge |
| Offline reload / PWA install | NOT RUN | Depends on the above |
| Pointer/keyboard editor interactions | NOT RUN | Not exercised by automation yet |
| Real File System Access Save/Save As/conflict | NOT RUN | Needs Chromium with real disk; engine-level logic covered only by unit tests above |
| Ten scenarios through real UI | NOT RUN | Engine-level only (see tests) |
| Accessibility, 8 GB Windows, cross-browser, expert review | NOT RUN | |

Not production-ready. No deployment performed.
