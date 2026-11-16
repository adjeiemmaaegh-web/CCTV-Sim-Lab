# SecurityLab — 40-device / 60-wall automated browser responsiveness probe

**Date:** 17 November 2026 (Asia/Dubai).  
**Evidence-bearing test commit:** `fbe3cb3d2701389a1719d9a6bc343a40f4034fbe` on QA branch `qa-large-layout-stress-2026-11-17` (PR #13).  
**Feature release baseline before QA:** `main` `baf0d970833798f9e0402c31dca3058f39da459a`.  
**Manual acceptance gate:** C2 in [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) — 8 GB Windows 11 integrated-GPU machine, 40 devices + 60 walls, drag frames **under 100 ms**. **C2 remains NOT RUN on required physical hardware.**

## Test scenario (scripted synthetic workload)

`SecurityLab/frontend-react/e2e/large-layout.spec.ts` constructs a valid SecurityLab project with **40 generic simulated IP bullet cameras** and **60 non-overlapping virtual wall segments** within the SVG plan. The project is imported through the real web UI using its JSON file input; the test requires 40 device and 60 wall DOM groups. It then holds a pointer on a camera, issues **24 scheduled pointer movements** and releases it, verifies the device moved, and uses Undo to require the original coordinates and object counts. Browser `requestAnimationFrame` timestamps are sampled during this interaction; sample counts and p50/p95/p99/max intervals are recorded in JSON attachments. Tests reject JavaScript page errors and failed drag/Undo outcomes.

This tests the 40/60 renderer and common interaction path with all-camera coverage computations. It does not model a deployed installation (cameras lack physical wiring, NVR or power), nor all possible mixed equipment/cable scenarios.

## Exact-run evidence

| Dimension | Linux GitHub runner / Chromium | Windows Server 2025 GitHub runner / Chromium |
|---|---:|---:|
| Workflow | [CI run 43965020540](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43965020540) | [Windows QA run 43965020526](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43965020526) |
| Overall workflow | PASS | PASS |
| Unit suite | 171/171 | 171/171 |
| Chromium E2E suite | 70/70 | 70/70 |
| Loaded devices / walls | 40 / 60 | 40 / 60 |
| Imported project to DOM rendered | 172 ms | 200 ms |
| Scripted 24-step drag wall-clock | 844 ms | 837 ms |
| Sampled browser frames | 57 | 56 |
| rAF frame-interval p50 | 16.7 ms | 16.7 ms |
| rAF frame-interval p95 | 16.7 ms | 16.7 ms |
| rAF frame-interval max | 16.8 ms | 16.8 ms |
| Functional drag, Undo and count check | PASS | PASS |
| Observed JavaScript errors | 0 | 0 |
| Machine-labelled JSON artifact | [Linux metrics artifact](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43965020540/artifacts/14273824982) | [Windows metrics artifact](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43965020526/artifacts/14275866838) |

The observed metrics are **one synthetic test run per operating system**, not statistically independent performance distributions or calibrated measurements of human input latency. Each rAF value represents time between browser animation callbacks during the scripted drag. The whole drag duration also includes automated pointer-dispatch and explicit pauses. These values should not be interpreted as guaranteed frame-time limits on a real shop computer.

**User-agent and device-memory caution:** Playwright's desktop-Chrome device descriptor reports `Windows NT 10.0` even in the Linux runner; the browser's `navigator.deviceMemory` value (8 GB) is a browser hint and **does not establish that the Windows runner had exactly 8 GB physical RAM**, an integrated GPU, or Windows 11. Windows hosted runner was Windows **Server 2025**, not Windows 11.

## Traceability and caveats

- Earlier CI attempts on this QA branch failed **before any stress test executed** because an initial test import pointed to repository-root `src/` instead of `SecurityLab/src/`. The path was corrected at `fbe3cb3d...`; the final code-bearing Linux and Windows Chromium runs passed. The earlier failures remain in Actions history.
- GitHub-hosted runner execution and Chromium Playwright cannot substitute for the physical Windows 11 8 GB integrated-graphics test. Environment, GPU acceleration/driver, screen-reader settings, browser profile, OS native file handles, touch and sustained work-session behavior differ.
- No runtime app logic, physical camera, PoE switch, NVR, cloud storage, permissions, deployment or financial features were changed in this QA increment.
- The owner must still run the [physical acceptance procedure](OWNER_WINDOWS11_ACCEPTANCE_RUNBOOK.md), record C2 drag measurements and evidence in the [owner acceptance form](OWNER_ACCEPTANCE_RESULTS_TEMPLATE.md), and mark PASS/FAIL only after real-device results.
- Release decision remains **NO-GO** until all required physical and professional gates are signed off.

