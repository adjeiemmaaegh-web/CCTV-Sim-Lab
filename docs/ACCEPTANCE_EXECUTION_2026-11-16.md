# SecurityLab — acceptance execution and evidence register
**Evidence date:** 2026-11-16  
**Production source:** `main` commit `2ad0a41a1c83b438efe2643666732d5fd3cbb397`  
**Production site:** https://securitylab-theta.vercel.app/  
**Scope:** acceptance follow-through, not a new product release or professional sign-off  
**Authoritative test protocol:** [Manual acceptance checklist](MANUAL_ACCEPTANCE.md)  
**Overall gate:** **NO-GO — manual device, accessibility and content checks remain unverified**

## Verified evidence (different from final user-device acceptance)

1. GitHub main CI run [43877160667](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43877160667) on the above production SHA: 171/171 Vitest checks and 69/69 Chromium Playwright tests passed, TypeScript and production build passed, npm audit reported zero vulnerabilities. Browser E2E ran against a local preview, not the live Vercel domain.
2. GitHub main artifact-only release workflow [43877160867](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43877160867): PASS. Its output is an **unsigned static package**, not a signed installer or release approval.
3. Vercel deployment was reported READY for the same production commit with aliases including `securitylab-theta.vercel.app`. This verifies deployment status, not all site behaviors.
4. In a separate remote Chromium-based live-browser session on the public URL, the page title was `SecurityLab | Engineering Workstation`; initial page loaded with no observed JavaScript errors; the service worker controller was `https://securitylab-theta.vercel.app/service-worker.js`, the registration was **activated**, and Cache Storage contained a `securitylab-react-*` entry with **seven URLs**.
5. In that live session, **Worked example** loaded six virtual devices and five cables. Diagnostics was opened. The **Assess Installation** workflow rendered a training report of **75/100**, marked improvement required, and explicitly disclaimed any professional qualification. This checks UI integration only, not a learner's competency.
6. **No viewport-overflow claim is made.** An initial agent report suggested overflow at 1440px, but follow-up measurements proved the browser could not actually resize below its 1920px viewport. At 1920px it measured innerWidth/clientWidth/scrollWidth=1920px. Smaller widths remain unverified by this remote session.
7. The live browser's Web Locks support was observed. No real Windows or OS filesystem save was performed from that session. Same-origin OPFS test doubles in CI do not count as A1–A8.

## Acceptance matrix

**Allowed labels:** PASS = exact documented acceptance on appropriate physical environment, with evidence; FAIL = reproduced failure; PARTIAL = only supporting evidence; NOT RUN = no execution on required hardware/browser; N/A = justified exclusion (owner decision). **None of the required physical rows is marked PASS**.

| Gate | Status | Evidence / action remaining |
|---|---|---|
| A1 — Windows new native Save As | NOT RUN | Windows 11 Chrome/Edge actual Desktop JSON file + revision 1/readback |
| A2 — edit/revision/checkpoint | NOT RUN | Save revision 2 and inspect the one checkpoint on real disk |
| A3 — refuse Save As overwrite | NOT RUN | Real picker selects same existing file; compare before/after bytes |
| A4 — Notepad change and concurrent writers | NOT RUN | External-edit conflict, two tabs, second browser/profile; backup losing draft and verify disk hash |
| A5 — file picker cancellation | NOT RUN | Cancel genuine OS picker and preserve in-memory draft |
| A6 — read-only/locked file | NOT RUN | Confirm clear error and no state/file replacement |
| A7 — corrupted JSON/open | NOT RUN | Reject checksum/JSON corruption, leave previous project intact |
| A8 — unsaved tab close | NOT RUN | Confirm leave warning on dirty project, none for untouched |
| B1 — installed service worker | PARTIAL | Remote live origin has activated controlling SW and seven cached URLs; repeat on owner Windows setup |
| B2 — installable PWA window | NOT RUN | Install in Chrome/Edge on target Windows, verify icon/window |
| B3 — physical offline cold restart | PARTIAL | Chromium process-level cold restart with persistent profile, stopped HTTP origin and offline project export passed on Linux/Windows CI (runs 43977943909/43977943898); physical Wi-Fi-off installed-PWA cold restart NOT RUN |
| B4 — safe PWA update negotiation | PARTIAL | Linux/Windows Chromium controlled localhost staging/refusal/verified-save update test passed (QA runs 43971845610/43971845666). Actual installed-PWA update on owner device NOT RUN; separate approved nonproduction changed-build deployment required |
| C1 — real cross-browser flows | PARTIAL | Firefox 38/38 and Linux WebKit 38/38 automated checks passed in QA run 43950976466; Chromium 69/69. Physical Edge/Firefox/Safari manual acceptance remains outstanding |
| C2 — low-spec responsiveness | NOT RUN | 8 GB Windows 11 integrated GPU, 40 devices + 60 walls, actual drag-frame measurement under 100ms |
| C3 — actual tablet/phone touch | NOT RUN | Android and iPad Safari/Chrome place/move/zoom/Tools |
| C4 — NVDA/VoiceOver + French | NOT RUN | Screen-reader keyboard/tab/speech/locale checks with evidence |
| C5 — contrast and motion | NOT RUN | Windows high contrast and reduced-motion usability |
| D — professional content and French review | NOT RUN | Qualified installer/instructor sign-off for Ghanaian scenarios and formulas; native French review |
| E — signed/unsigned package decision | PARTIAL | Unsigned static artifact CI built; owner must decide final release, signing requirement, and package verification |

## Execution order and evidence protocol

**Owner/tester: Windows 11 laptop** — complete A1–A8 and the A4 extension first, recording OS/browser version, filename, file SHA-256 before/after, screenshots and all result messages. Use a separate disposable `.securitylab.json` test project. **Never test intentional corruption or overwrite against valuable originals**. Next, complete B1–B4 using an installed test PWA on the approved test site; B4 requires a *controlled nonproduction update* and user-saved backup. Then C1–C5 on named physical browsers/devices; use automated Firefox/WebKit results only as supporting evidence, **not** a substitute for Safari, iPad, or Edge. Finally conduct qualified human content review D and an explicit owner package/release decision E.

For every gate, record: gate ID, date and timezone, tester/reviewer, exact `main` SHA, browser/OS/device, source project file hash (if applicable), steps attempted, expected result, observed result, screenshot/log location, defect ticket, and PASS/FAIL. Any missing evidence remains NOT RUN/PARTIAL. The QA workflow itself is the source of truth for its own cross-browser engine results; this register must be updated with the exact run ID and counts before claiming the automated job passed.

## QA continuation — 2026-11-17 (Dubai local date)

**Accepted source remains main `2ad0a41a1c83b438efe2643666732d5fd3cbb397`.** This is a QA-only branch; no product code was merged for the cross-browser check. The final QA test implementation at branch commit `055c24889d3e238c66039cee4ced4d5d29a6c56f` replaced **only WebKit's offline-emulation method** with an independent static file server. The test first loads the real built app, waits for a controlling service worker, confirms a populated cache containing `/index.html`, **stops the local HTTP server entirely**, then requires a successful HTTP 200 navigation response **from the service worker**, with the full application workspace visible. Firefox and Chromium continue their `context.setOffline(true)` checks.

- Initial [Firefox/WebKit run 43880503877](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43880503877), including a single rerun, **FAILED 75/76 twice**: WebKit failed `page.reload()` with an internal browser error only when Playwright marked its context offline. This reproduces the category of upstream [Playwright WebKit issue #42775](https://github.com/microsoft/playwright/issues/42775); it is not evidence that actual Safari on a physical device works or fails.
- [QA standard CI 43950976430](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43950976430) on `055c24889d3e238c66039cee4ced4d5d29a6c56f`: **PASS** — 171/171 Vitest, 69/69 Chromium E2E, typecheck/build and dependency audit with 0 vulnerabilities reported.
- [QA cross-browser run 43950976466](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43950976466) on that same head: **PASS 76/76** — Firefox **38/38**, Linux WebKit **38/38**. Both browsers passed their respective service-worker/offline tests. No retries/skips were needed in this final run.
- This confirms **limited engine-level offline shell fallback** in a Linux runner, using a genuinely stopped origin; it does **not** exercise real Wi-Fi disconnect, iPad/Safari installation, closed-browser PWA reopening, physical laptop files, or OS-level concurrent writes. B3 and physical C1 remain **NOT RUN/PARTIAL** per the original acceptance rules.
- The real-device follow-up remains tracked in [SecurityLab issue #10](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/10). Do not close that acceptance gap based solely on this automated success.

## PWA update QA continuation — 17 November 2026

- Source from `main` `7ccc22b14483780d0c590f936daad134dd2e7064` was extended **only in tests and documentation**, PR [#14](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/pull/14), code-bearing head `9f1133a06d04e94be09ea3b8f9006dd73d0c5ef0`.
- [Linux run 43971845610](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43971845610): **171/171 unit, 71/71 Chromium PASS**. [Windows Server run 43971845666](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43971845666): **171/171 unit, 71/71 Chromium PASS**, static package integrity checked. [Firefox/WebKit run 43971845716](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43971845716): **76/76 existing browser-engine tests PASS**, not including the new Chromium-only update case.
- Controlled PWA update test confirmed a changed service worker **waits without activating**, **cannot force the update after a download-only unverified save**, preserves the in-memory edit, then activates/reloads only following a confirmed OPFS-backed file write/readback. Saved revision and checksum were checked independently.
- This is evidence for the update **handshake in automated browsers only**. No genuine physical Windows 11 picker, installed Windows or iPad PWA update, lost-network cold restart, changed app asset bundle, or complete native-device B4 behavior was exercised. [Detailed update test report](QA_PWA_UPDATE_2026-11-17.md) records all constraints.
- **B4 stays PARTIAL (manual NOT RUN); real-world A/B/C/D acceptance and E owner signoff remain NO-GO.** [Owner acceptance issue #12](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/12) remains open.

## PWA cold browser restart QA continuation — 17 November 2026

- QA PR [#15](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/pull/15) extends only browser tests and the evidence register from `main` `8c65e66e38725ecdc102f34cd4ab5ae263b191f8`. The new process-restart test originated at commit `24b37503f0d8c9ebc61c3459b015cbf27dd9acc7`.
- [Linux CI 43977943909](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43977943909): **171/171 unit, 72/72 Chromium PASS**. [Windows Server 2025 QA 43977943898](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43977943898): **171/171 unit, 72/72 Chromium PASS** and unsigned package integrity verified.
- The test uses a **persistent browser profile**, completely closes the first Chromium browser process, stops the server, opens a fresh Chromium process on the same profile, and requires service-worker-originated HTTP 200 navigation plus functional offline worked-example and valid JSON backup export. [Detailed reproducible evidence report](QA_PWA_COLD_RELAUNCH_2026-11-17.md).
- **B3 is PARTIAL automated support only.** No physical Windows 11/Wi-Fi-off restart, installed PWA window, physical machine reboot, smartphone/tablet or real-device file picker was tested. Earlier same-tab WebKit stopped-origin fallback remains supporting but is not a full browser-process restart. B1/B2 and the physical A/C/D/E acceptance remain unverified. [Owner acceptance issue #12](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/12) remains OPEN.
- No runtime application code was changed, and the simulator's virtual camera and recording behavior is educational, not live equipment confirmation. Overall professional release **NO-GO**.

## Open risks and decisions

- Browser Web Locks serialize cooperating tabs on the same origin and browser profile only; they are not OS file locks. External file editors and other origins/profiles can still race. Demonstrate the single-writer policy and recovery using A4.
- Real installed-PWA cold restart on a physical Wi-Fi-disconnected target device is **not** established by a controlling service worker, cache presence or a hosted-runner browser-process restart; complete the owner B3 procedure.
- The software's calculated security-system behavior and training scores are educational simulations, not real camera/network/electrical measurements or professional certification.
- Full completion and release approval remain **NO-GO** until physical gates, accessibility review, professional content review and owner sign-off have verifiable evidence.
