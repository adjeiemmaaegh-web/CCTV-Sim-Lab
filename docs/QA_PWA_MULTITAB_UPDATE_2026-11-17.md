# SecurityLab — multi-tab PWA update consent and failure safety

**Date:** 17 November 2026 (Asia/Dubai).  
**Baseline:** `main` `0038d2641a3699ac899ca6e65a5966057cdbd776`.  
**Test-bearing branch commit:** `593e1a2835af3417ac1039431e1065e43caec777`, [PR #16](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/pull/16).  
**Scope:** actual application-source safety fix, offline shell generator change, automated Chromium test and documentation. **Not** real-device B4 acceptance or professional release.

## Source-level issue

Before this change, `SecurityLab/frontend-react/src/offline.ts` invoked the requesting editor's `flush()` and then directly posted `ACTIVATE_UPDATE` to a waiting worker. The generated service worker in `scripts-build-pwa.mjs` handled that message with unconditional `self.skipWaiting()`. **No other open editor window was queried.** A clean tab could therefore activate a new service-worker version while another same-origin tab had unsaved in-memory edits. Whether that immediately discarded the second tab depended on browser/tab behavior, but allowing activation without its consent was an unjustified risk.

## Changes

- The app registers a read-only handler for `SECURITYLAB_UPDATE_SAFETY_CHECK`. It reports **unsafe** when the peer editor has unsaved work, a blocked save, a pending save, or is not fully loaded. It never opens a file picker or saves another tab on request.
- The waiting worker handles `ACTIVATE_UPDATE` only with a MessagePort acknowledgement, enumerates origin clients via `clients.matchAll({type:'window',includeUncontrolled:true})`, and asks **all available window clients** for explicit safety responses. A refusal, exception, missing response or 2.5-second peer timeout **prevents `skipWaiting()`**. The requesting UI waits for a positive acknowledgement (maximum six seconds), otherwise explains that another tab might have unsaved work.
- On `controllerchange`, only the requesting editor with acknowledged consent and a locally safe state reloads automatically. Other tabs are never automatically saved or reloaded by this flow.
- Existing single-tab save confirmation, OPFS-backed test double and offline-caching architecture are retained.

**Important consistency limits:** this is cooperative *per-service-worker-registration/origin* status checking, **not a lock** against later edits. There is a time-of-check/time-of-use window if a peer starts editing after replying. The service worker cannot query other browser profiles, other origins, external file editors or disconnected windows, and it does not establish OS-level atomic writes or universal version coordination. A nonresponding scoped client causes a blocked update by design. Active tabs may continue displaying an older version after a later approved update rather than refreshing automatically.

## Browser regression and exact-source evidence

`e2e/pwa-multitab-update.spec.ts` uses two pages on one disposable localhost origin. Both are served the actual generated SW. Tab B changes `Night` and is confirmed unsaved, while tab A is pristine. A new test SW version is published and waits. A's `Save & update` must **be refused without activating the worker**; tab B retains its draft. B then saves to a separately named OPFS-backed handle, whose JSON is read and verified (Night true, revision 1, SHA-256 checksum). A retries; the new SW activates, A reloads and B's page remains open. JS page errors are rejected. This test exercises a changed SW cache identity, not a complete deployed new asset bundle.

| Environment | Workflow | Evidence |
|---|---|---|
| Ubuntu 24.04 hosted Chromium | [CI 43990143551](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43990143551) | **171/171 unit, 73/73 Chromium E2E PASS**, including new two-tab test |
| Windows Server 2025 hosted Chromium | [Windows QA 43990143513](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43990143513) | **171/171 unit, 73/73 Chromium E2E PASS**; unsigned package integrity verified. SHA-256: `5d72e8706b244ad02b3c5781ebb7d54c957931d97e417c2a60e74555a12dfcd3` (8 manifest entries) |

These results are GitHub-hosted browser tests, not 8 GB Windows 11 laptop tests. All File System Access saves are OPFS-backed **test doubles**; no real Windows file-picker permission or physical disk safety was proven. Firefox and Linux WebKit run pre-existing cross-browser tests but do not execute the Chromium-only two-tab update test.

## Remaining release gates

- **B4** now has a specific engineered multi-tab guard and repeatable automated coverage, but **physical installed-PWA update testing remains NOT RUN**. The owner must conduct a separately approved staged version update with two real editor windows and at least one unsaved draft, inspect app behavior, save/discard only by explicit user choice, record genuine file hashes and version changes, and confirm no unintended reload.
- **A1–A8** physical Windows 11 file picker/OS external-edit conflicts, **B3** genuine Wi-Fi-off installed-PWA restart, device/accessibility/performance checks **C**, qualified technical/instructional content review **D**, and owner release decision **E** remain open.
- No production device installation, cloud migration, payments, professional certification or commercial launch is authorized here.

**Release status remains NO-GO.** [Owner acceptance issue #12](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/12) remains OPEN.
