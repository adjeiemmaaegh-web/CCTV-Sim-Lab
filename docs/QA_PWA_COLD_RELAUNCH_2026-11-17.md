# SecurityLab — browser-process offline cold relaunch QA

**Evidence date:** 17 November 2026 (Asia/Dubai).  
**Source under test:** QA branch commit `24b37503f0d8c9ebc61c3459b015cbf27dd9acc7`, PR [#15](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/pull/15).  
**Base production source when the branch was created:** `main` `8c65e66e38725ecdc102f34cd4ab5ae263b191f8`.  
**Gate:** B3, [Manual acceptance](MANUAL_ACCEPTANCE.md): installed app completely closed, physical Wi-Fi off, reopened on actual device with usable offline tools and files. **Manual B3 is NOT RUN; this is PARTIAL automated evidence only.**

## Executed procedure

`SecurityLab/frontend-react/e2e/pwa-cold-relaunch.spec.ts` uses the real built SecurityLab shell, its original generated service worker, Playwright Chromium with a **persistent temporary user-data directory**, and an independent local HTTP static origin.

1. First Chromium browser process opens the disposable local origin, allows the actual service worker to install, reloads to obtain a controlling worker, confirms one activated worker and one cached `/index.html`.
2. **Closes the complete browser context/process**, not just the page.
3. **Stops the HTTP server entirely**, disconnecting the original origin before a new browser process starts.
4. Starts **a new Chromium browser process** using the **same persistent profile directory** and opens the original URL. Requires HTTP 200 navigation **from the service worker** (not the unavailable server), controlling SW and visible engineering workspace.
5. With the server still stopped, loads the actual six-device worked example, verifies four cameras recording in the educational simulator, downloads **Export Backup**, parses the saved JSON, checks six simulated devices, `securitylab.project-file` format and SHA-256 checksum syntax, and verifies no JavaScript page errors.
6. Closes the second browser process and removes the disposable local profile. The test neither uses private user files nor contacts the Vercel production service.

## Automated test evidence

| Check | Linux hosted runner / Chromium | Windows Server 2025 runner / Chromium |
|---|---|---|
| Workflow | [CI 43977943909](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43977943909) | [Windows QA 43977943898](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43977943898) |
| CI result | **PASS** | **PASS** |
| Unit tests | 171/171 | 171/171 |
| Chromium browser tests | 72/72 | 72/72 |
| Two separate Chromium process launches | PASS | PASS |
| HTTP origin stopped before second launch | PASS | PASS |
| Cold navigation response | **200, from service worker** | **200, from service worker** |
| Offline worked-example devices | 6 | 6 |
| Offline export backup and checksum | PASS | PASS |
| Browser page errors | 0 | 0 |
| Static unsigned package hash verification | Not part of Linux CI | PASS, 8 manifest entries |

The test-bearing CI runs log `COLD_RELAUNCH_PROBE` with the process/origin classification and required outcomes. GitHub's `GITHUB_SHA` value shown inside pull-request job logs may identify a temporary PR merge commit; the source head used for the PR is the commit stated above.

## Evidence limits

This verifies **browser-process restart and persisted service-worker cache** against an **unavailable test origin**. It is stronger than a same-tab offline reload, but does **not** simulate shutting down the Windows operating system, installing and launching a genuine standalone PWA window via Start, switching off a physical network adapter, a flaky connection, a full build update, a phone/tablet, or a true 8 GB Windows 11 integrated-GPU system. Windows CI is **Windows Server 2025**. There is no real CCTV/NVR/PoE equipment integration in this test.

A saved project is user-owned JSON; the test creates a *new* worked example and exports it while offline. It does not prove that a previously unsaved in-memory draft will survive browser closure, and must never be represented as doing so.

**B3 remains PARTIAL supporting automation / physical NOT RUN**, and [owner acceptance issue #12](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/12) remains **OPEN**. On actual Windows 11, the tester must preload the app online, install it, **fully close it**, turn off internet connectivity, reopen the installed window from Start, use scenarios, place and move devices and save/download a local project, and capture screenshots and physical environment details. No professional/commercial release approval is implied.

**Release status:** NO-GO until the remaining manual A/B/C/D/E acceptance and owner release decision are documented.
