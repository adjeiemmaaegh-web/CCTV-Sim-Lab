# Manual acceptance checklist (needs a person, a headed browser and real hardware)

Automated tests cannot cover these. Record PASS / FAIL / date / browser+OS version for each. Do not mark the
release gate passed until every row is PASS. Nothing here has been executed yet.

## A. Real-disk project files (Chrome or Edge on Windows 11)
| # | Step | Expected |
|---|---|---|
| A1 | Serve the app (`npm run preview`) and open it. New project -> Save As -> choose a **new** file on the Desktop | Notice says "Saved and read back ... (revision 1)"; file exists and is valid JSON with `"format": "securitylab.project-file"` |
| A2 | Edit, press Save Project | Revision 2; the file now has one checkpoint |
| A3 | Save As and pick the **same existing file** | Refused ("Choose a new filename"); file bytes unchanged |
| A4 | Open the saved file in Notepad, add a space, save. Back in the app press Save Project | Conflict message; the file keeps the Notepad edit |
| A5 | In the picker dialog press Cancel | "File picker cancelled"; no data lost |
| A6 | Open the file while it is read-only / locked by another program | Clear error, project unchanged |
| A7 | Edit the file by hand to corrupt the JSON, then Open | "checksum mismatch" or "Invalid JSON"; nothing overwritten |
| A8 | Close the tab with unsaved edits | Browser leave-page warning; none for an untouched new project |

### A4 extension — exclusive-writer acceptance (part of A4, not a substituted mock)

After A4's external-edit conflict check, repeat with **two actual Chrome/Edge editor tabs or installed PWA windows** on the same origin holding the same real project file. Both open revision 1; independently change the draft, save one, then save the stale second editor. The stale operation must display a conflict instead of silently replacing the newer file. Preserve and inspect the on-disk revision plus **Export Backup** from the losing editor. Repeat with an external file editor, another browser profile or different origin and record the result honestly: **Web Locks protect only cooperating same-origin windows in one browser profile; they are not an OS filesystem transaction.** A failed external race is a release blocker until the single-writer policy and recovery procedure are demonstrated and accepted. Also test an interrupted or denied write: prior disk bytes must remain intact, the UI must show a block, and the unsaved draft must be exportable. Record browser build, operating system, real filename, byte/hash comparison, screenshots, outcome, and reviewer.

## B. Offline PWA (Chrome or Edge, https or localhost)
| # | Step | Expected |
|---|---|---|
| B1 | Load once online, wait for the service worker, check Application > Service Workers is "activated" | controlling the page |
| B2 | Install the app (address-bar install icon) | Installs with the SecurityLab icon; opens in its own window |
| B3 | Turn Wi-Fi off, close and reopen the installed app | Opens fully; tools, scenarios and Save As (download or file) work |
| B4 | Deploy a changed build, reopen online | Banner "A new SecurityLab build is available"; it does **not** activate while edits are unsaved |

## C. Devices and browsers
| # | Check |
|---|---|
| C1 | Firefox, Safari and Edge: run the 10 core flows (place, cable, scenario, save/download, open) |
| C2 | 8 GB Windows 11 laptop, integrated graphics: 40 devices + 60 walls stays responsive (< 100 ms per drag frame) |
| C3 | Android and iPad Safari/Chrome: place, move, zoom and open Tools by touch |
| C4 | Screen reader (NVDA or VoiceOver): reach every tool tab and hear lesson steps in the active English interface |
| C5 | Windows high-contrast / reduced-motion modes remain usable |

## D. Content review (people)
Qualified installers/instructors must review: scenario briefs (especially the Ghana-context ones), the good-practice
rules, lens/PoE/RAID formulas and fire-detector radii. Record reviewer, date and corrections. French localization review is deferred.

## E. Packaging and signing (owner decision)
`npm run package` produces an **unsigned, reproducible** static zip with SHA256SUMS. A signed installer needs a
code-signing certificate and an owner decision; none exists. Publishing or hosting the package is a separate
owner-approved step: the release workflow only attaches an artifact.