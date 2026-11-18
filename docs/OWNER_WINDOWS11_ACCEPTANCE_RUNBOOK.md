# SecurityLab — owner-run Windows 11 and offline PWA acceptance kit

**Revision:** 17 November 2026  
**Current verified production source when authored:** `20f4da275293a04eb5b5f4d786c58af15f46fa03`  
**App:** https://securitylab-theta.vercel.app/  
**Authoritative gate definitions:** [Manual acceptance](MANUAL_ACCEPTANCE.md)  
**Record results in:** [Acceptance evidence form](OWNER_ACCEPTANCE_RESULTS_TEMPLATE.md)  
**Release status:** **NO-GO** until each required physical/manual gate has appropriate evidence and an authorized release decision. This document is a procedure, **not evidence that testing happened**.

## Before the first test

Use **one actual Windows 11 computer**, preferably the intended low-spec 8 GB computer, and a current **Chrome or Edge** version. You **do not** need to install Node.js, run CMD, edit source, or download a simulator runtime to test the public preview. Use only your own test files and a clean disposable project.

1. Record the actual Windows edition/build (`Settings > System > About`), RAM and GPU (`Settings > System > Display > Advanced display` or Task Manager), Chrome/Edge version (`Settings > About`), and your timezone.
2. Create a **new empty folder** `SecurityLab-Acceptance-Test` on your Desktop. Keep original business or learner projects elsewhere; **never intentionally corrupt or overwrite them**. Close old SecurityLab windows/tabs before beginning.
3. Navigate to https://securitylab-theta.vercel.app/ while online and wait for the application to finish loading. The page should identify itself as the virtual training workstation. If browser permissions appear, grant only the file access required for this **disposable** test project.
4. Take a screenshot of the initial app (`Win + Shift + S`). Name evidence files with the gate ID: e.g. `A1-before.png`, `A1-after.png`, `A1-file.json`. Record actual observed text and do not turn a screenshot into an invented PASS.
5. Verify the source **Git SHA** for the deployment using the project's GitHub `main` and the linked Vercel deployment at test time. If the running deployment uses a newer commit, record its actual SHA rather than copying the historical one above.

If a browser offers only **download-style Save As**, capture that behavior. It does **not** satisfy the **native physical-disk file-handle** portion of A1–A6; it may still support download/export fallback behavior.

## Part A — real Windows disk file behavior (A1–A8)

| Gate | Actual action on the disposable test folder | Record / expected behavior |
|---|---|---|
| **A1** | In the Project menu choose New, then Save As; choose a *new* `securitylab-qa-A1.securitylab.json` file in the Desktop test folder | A confirmed **revision 1** save/readback; actual file exists; inspect the JSON `format`, `revision` and `checksum` fields without editing |
| **A2** | Change the **Night** checkbox or place a device; Project > Save Project | **Revision 2**; disk document contains the changed value and exactly one historical checkpoint |
| **A3** | With the saved project still open, choose Project > Save As and deliberately select its **existing filename** | App refuses replacing an existing nonempty project and original bytes/hash are preserved; if the OS itself blocks the picker selection, record the precise observed behavior |
| **A4** | Close any competing app; use **Notepad** to append one harmless blank space to the test JSON and save it. Back in SecurityLab edit the in-memory project and choose Save Project | Explicit conflict or blocked-save warning; disk bytes retain the Notepad edit. Use the app's **Export Backup** to download the unsaved draft **before** reopening the original |
| **A4 concurrent-writer extension** | Open *the same physical file* in two cooperating Chrome/Edge tabs of the same site/profile, then make distinct edits. Save tab 1; try to save stale tab 2. Finally repeat using a different browser/profile or an external editor | The cooperating stale tab must fail safely and expose backup/recovery; hash and inspect both drafts. Cross-profile/editor locking is **not guaranteed** by Web Locks; document actual outcome, never call it atomic |
| **A5** | Make a harmless unsaved change, choose Project > Save As, then **Cancel** in the real operating-system picker | No project switch and no loss of the in-memory edit; capture any cancel message |
| **A6** | Make a *copy* of the test file, mark it read-only in Windows Properties or use an application that holds an exclusive lock, then attempt Open/Save | Clear failure/recovery response when the operation is denied; original project preserved. Read-only flags and locks vary: separately record whether the OS actually denied access |
| **A7** | Copy the saved file to `securitylab-qa-CORRUPTED.securitylab.json`, open *that copy only* in Notepad, and change/delete a JSON character or the checksum. Use Project > Open to select the corrupt copy | Reject with invalid JSON or checksum message; active original project and its file remain unchanged |
| **A8** | Start an untouched new project and close the tab, then open a project, make an unsaved change, and attempt to close the tab | Untouched project closes without unnecessary warning; changed project displays the browser's standard leave-page warning. Browser wording varies |

**File hash (recommended evidence; optional PowerShell):** Open Windows PowerShell, replacing the path with your **disposable** file and run:

```powershell
Get-FileHash -Algorithm SHA256 "$env:USERPROFILE\Desktop\SecurityLab-Acceptance-Test\securitylab-qa-A1.securitylab.json"
```

Copy the SHA-256 value into the result form before and after the A3/A4/A6 tests. If A3 or A4 modifies bytes despite a refusal, mark **FAIL**, preserve the two files and stop tests on that file.

**If a save is blocked:** First choose **Export Backup**, verify the downloaded JSON opens as a separate file and contains the intended unsaved change, then reconcile/reopen the disk copy or Save As a **different new filename**. Do not repeatedly retry a known-conflicted overwrite.

## Part B — installed offline PWA (B1–B4)

Use a new disposable project on the **same site origin**. This part must happen on a real device; a GitHub Actions browser cannot attest to an installed PWA in your Windows profile.

- **B1 — service-worker control:** With Wi-Fi **on**, visit the app; open browser Developer Tools (`F12`) > Application > Service Workers and record whether the worker is **activated** and the page is **controlled**. A cached icon or "install available" message alone is not B1.
- **B2 — installation:** Use the browser's **Install app** command (address bar or browser menu). Confirm a distinct SecurityLab app window opens, the app icon appears, and basic controls work.
- **B3 — genuine disconnected restart:** After online preloading, **turn off Wi-Fi (and other internet connections)**. Fully close every installed-app window; restart the installed app from Windows Start/apps. Confirm the **full offline shell** opens, a scenario can be selected, a virtual device can be placed, and a project can be exported/downloaded or saved to a local file. Record screenshots and ensure the device really had no internet connection. Turn Wi-Fi back on after the test.
- **B4 — update safety:** Requires a separately authorized **nonproduction test deployment** of a changed build. Do not modify or overwrite the existing production alias just to test updating. With unsaved edits open, confirm the update prompt does **not** silently replace the page or discard changes. Record the old/new build hashes and whether update was applied only after the tester consented. **Do not mark B4 PASS without a controlled version change.**

If B3 fails, capture whether the OS displays a network error, a blank screen, missing assets, or a partially loaded interface. Preserve screenshots and the exact Windows/browser versions.

## Part C — other devices and professional reviews

The [master manual checklist](MANUAL_ACCEPTANCE.md) also requires: **C1** physical Edge/Firefox/Safari core flows, **C2** 40 devices and 60 walls on an **8 GB Windows 11 machine** (drag frame under 100 ms), **C3** real Android/iPad touch, **C4** NVDA/VoiceOver, **C5** Windows contrast/motion preferences; **D** qualified installer/instructor review; and **E** an explicit owner signing/packaging/release decision. French localization review and source licensing are deferred.

A Windows Server 2025 GitHub runner is useful evidence for cross-OS JavaScript/build behavior, but it does **not** have the required Windows 11 personal-machine environment, true native OS picker user interaction, low-RAM graphics profile, or human screen-reader and professional reviewers.

## Evidence submission / release gating

For **each** row, complete [the result template](OWNER_ACCEPTANCE_RESULTS_TEMPLATE.md): gate, tester, date/timezone, hardware/browser/OS, Git SHA, steps, actual outcome, **PASS / FAIL / NOT RUN**, image/log references, and file hashes when relevant. Do not mark a gate PASS because another related automated test passed.

**Suggested order:** A1→A2→A3→A4 plus dual-writer→A5→A6→A7→A8→B1→B2→B3; keep B4 for a separately authorized version-update test. Then collect C/D/E. Any critical failure must be triaged as an issue and retested on the exact corrected source. No claim of certification, genuine equipment integration or production-ready installation training follows from an automated pass alone.
