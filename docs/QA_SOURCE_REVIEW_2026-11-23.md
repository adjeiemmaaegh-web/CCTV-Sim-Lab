# SecurityLab gap review — 23 November 2026

**Status: focused engineering fixes proposed; full professional/physical release remains NO-GO.**
This review uses the exact `main` SHA `bd60b4c074cd6af3d49c78ac843b6b84f54d9514`.
No deployment, merge, physical-device execution, signing, or release approval is implied.

## Verified baseline

- [Main CI run 45164884052](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/45164884052): passed strict TypeScript, **172/172** Vitest unit checks, **95/95** Chromium Playwright checks, Vite build, and both full/deployment dependency audits with zero reported vulnerabilities.
- [Artifact-only package run 45164884109](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/45164884109): passed and uploaded a package artifact; this is not publishing or signing.
- The Vite main entry JavaScript chunk remains **784.28 kB minified** (232.81 kB gzip) and exceeds the configured 700 kB warning. This is a measured size/performance follow-up, not proof of sluggish behavior on a specific physical device.
- The 40-device/60-wall Linux Chromium stress case reported **p95 16.8 ms** animation frame intervals during its scripted drag. This is **not** an 8GB physical Windows 11 acceptance result. The browser identifies 8GB deviceMemory under CI but CI runs on Linux; C2 remains NOT RUN.

## Targeted engineering changes in this branch

1. **Windows filename safety:** reject Windows device stems such as `CON.txt` and `LPT9.hidden` when generating default project filenames. Such names are reserved even with extensions. Add a unit regression with safe adjacent cases; this does not substitute for A1–A8 native picker testing.
2. **Exact-integrated-head QA:** run supplemental Windows Server 2025 and Firefox/Linux WebKit workflows on every `main` push, not only on pull requests or manual dispatch. The CI jobs remain tests only, with no deployment or automatic issue closing. Windows Server is not a physical Windows 11 endpoint.
3. **Documentation accuracy:** correct the README/roadmap that still described merged safety changes and UX enhancements as drafts or an old baseline.

## Outstanding gaps — not closed by this branch

- **A1–A8 (plus A4 extension):** genuine Windows 11 native Save As/Save, write/readback, stale-file/second-profile/external-editor collisions, cancellation, file locking, corruption, browser leave-page and recovery. A4 remains non-atomic across OS processes; a single-writer policy plus demonstrated recovery is required.
- **B1–B4:** real installed Windows PWA service-worker control, offline Wi-Fi-off closed-app reopen, and a safe changed-build update on an independently authorized nonproduction deployment.
- **C1–C5:** physical Edge/Safari/Firefox flows, 8GB integrated-GPU frame measurements, Android/iPad touch, NVDA/VoiceOver English navigation, high contrast/reduced motion.
- **D:** qualified security installer/instructor review of learning scenarios, equipment/network/electrical formulas and Ghana-specific content.
- **E:** owner packaging, signing/distribution and professional-use release decision. No auto-merge or public rollout.
- **Performance:** investigate the 784.28 kB main entry bundle without merely raising `chunkSizeWarningLimit`; benchmark any split on low-spec devices and repeat offline precache/update testing.
- **Browser automation:** confirm this PR's exact head has passed its own Linux, Windows-hosted and cross-browser runs; the historical successful main run does not validate code introduced here.

## Owner handoff

Use [manual acceptance protocol](MANUAL_ACCEPTANCE.md), [Windows 11 runbook](OWNER_WINDOWS11_ACCEPTANCE_RUNBOOK.md), [blank evidence form](OWNER_ACCEPTANCE_RESULTS_TEMPLATE.md), and existing [issue #12](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/12). The [Safari/iPad follow-up issue #10](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/10) remains open. Do not change physical gate statuses to PASS without dated native-device screenshots, file hashes, measurements, tester/reviewer identity, and reproduced observations.

**Decision:** this increment can be reviewed/merged if exact-head CI passes and code review accepts it; it cannot be marked a completed physical acceptance or professionally releasable product.
