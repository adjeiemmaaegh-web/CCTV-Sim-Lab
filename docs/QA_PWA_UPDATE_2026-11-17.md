# SecurityLab — controlled PWA update safety regression evidence

**Date:** 17 November 2026 (Asia/Dubai).  
**Baseline:** production `main` `7ccc22b14483780d0c590f936daad134dd2e7064` when QA branch was created.  
**Test-bearing SHA:** `9f1133a06d04e94be09ea3b8f9006dd73d0c5ef0` (draft PR #14).  
**Scope:** Evidence for B4 safety behavior in a disposable localhost browser origin. **Not an installed Windows 11/iPad PWA acceptance, and not a release approval.**

## What the automated test really does

The test `SecurityLab/frontend-react/e2e/pwa-update.spec.ts` uses the genuine built app and service worker, with a disposable local HTTP server (`e2e/update-origin.ts`). It initially serves the unmodified production build's service worker, then serves an altered service worker under **the same path** with a distinct test-cache identity. This is a controlled version change on localhost; the production Vercel deployment, public service worker and user project files are not modified.

The Chromium test:
1. Registers and controls the page with the initial service worker; checks the original offline cache exists.
2. Makes an **unsaved Night edit** and places a unique unsaved-page marker in memory.
3. Publishes the later test service-worker script, explicitly checks for updates, and requires the new worker to remain **installed and waiting** with the old worker **activated**. A waiting worker must not activate itself.
4. Clicks **Save & update** with the native file picker deliberately unavailable. The app requests a JSON *download*, but cannot confirm it reached a durable file. The test checks the update is **rejected**, the waiting worker stays waiting, and the in-memory Night edit and page marker remain.
5. Supplies an **OPFS-backed browser FileSystemFileHandle test double** to simulate a verified writable file. Clicks **Save & update** again. The actual app must write and read back the project, signal the waiting worker, activate the new SW and reload.
6. Opens the saved OPFS file independently and confirms `format: securitylab.project-file`, revision 1, `project.night: true` and SHA-256 checksum format. Confirms the new test SW cache is active, the old cache removed, and no JavaScript page errors were observed.

The second save uses the browser's origin-private filesystem with a test picker; **it is not** a real Windows 11 operating-system file picker, OS file lock, physical drive or hardware-backed durability test. It validates the application's *browser API* handshake, not an OS/user production workflow. The new SW contains a test-only changed cache identity; the scenario does not exercise a full new UI asset bundle, and cannot establish PWA installation/version upgrade behavior on real devices.

## Exact-code verification

| Workflow | Result | Evidence |
|---|---|---|
| Linux Chromium CI | **PASS** — 171/171 unit and 71/71 Chromium E2E | [Run 43971845610](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43971845610) |
| Windows Server 2025 Chromium CI | **PASS** — 171/171 unit, 71/71 Chromium E2E; unsigned package SHA manifest verified | [Run 43971845666](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43971845666) |
| Linux Firefox + WebKit regression | **PASS** — 76/76 existing browser-engine tests | [Run 43971845716](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43971845716) |

The controlled version-update test runs in **Chromium only** because its verified-save leg uses File System Access API test doubles. Linux Firefox/WebKit tests verify their existing behaviors, **not** this B4 scenario. All three listed runs used the exact code-bearing branch SHA above.

## Classification and remaining gates

- **B4 status: PARTIAL automation evidence, real-device update test NOT RUN.** This regression proves the staged-update/verified-save handshake on automated Chromium, not Windows 11 installed-PWA user interaction.
- The owner must still authorize a **separate nonproduction changed-build deployment**, install the app on Windows 11, make unsaved edits, observe a real available update, validate it cannot silently replace those edits, then opt in only after an actual disk save. Capture old/new version hashes and screenshots.
- **B3** genuine internet-disconnected app close/restart and **A1–A8** actual Windows native file save/conflicts are unverified. **C1–C5**, professional **D** and owner release decision **E** remain open.
- No software promotion, sign-off, paid services, real-device execution or certification results are claimed by this test.
- The educational simulator remains **NO-GO for professional release** until the documented physical acceptance and human reviewer evidence is collected. See [manual acceptance](MANUAL_ACCEPTANCE.md) and [owner evidence form](OWNER_ACCEPTANCE_RESULTS_TEMPLATE.md).
