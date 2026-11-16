# SecurityLab — owner acceptance results (blank evidence form)

> **Unexecuted template — no physical gate has been passed by creating this file.** Copy this file to a new named record for each device/test session. The underlying procedure is [the Windows 11 runbook](OWNER_WINDOWS11_ACCEPTANCE_RUNBOOK.md) and [master acceptance protocol](MANUAL_ACCEPTANCE.md).

## Test session

| Field | Actual value (complete during test) |
|---|---|
| Tester and role | |
| Date and timezone | |
| GitHub `main` commit / Vercel build hash | |
| Tested URL, origin and PWA install origin | |
| Windows edition/build or mobile OS/build | |
| Browser name and version | |
| Physical device model, RAM and GPU | |
| Internet state, offline proof | |
| Disposable test file/folder | |
| Screenshots and logs location | |
| Signature / second-person reviewer | |

## Pass/fail criteria

**PASS** means the named gate was *actually executed on its required environment* and the observed result matches the manual protocol, with supporting evidence. **FAIL** means an actual mismatch was reproduced; record an issue and preserve the evidence. **NOT RUN** means no required physical execution. **PARTIAL** means relevant automated evidence or incomplete manual execution exists but acceptance is not established. **BLOCKED** means the required device, permissions, reviewer, or approved test deployment is unavailable.

**A4** includes two separate tests: Notepad external edit and multiple actual writer windows/profiles. **B3** includes real disconnection and reopening a closed installed app. **C2** needs a real 8GB device and measurements, not CI timing. **D** requires qualified human review. **E** requires owner authorization.

| Gate | Current status | Actual results / expected vs observed | Evidence paths, SHA-256 before/after, issue ID |
|---|---|---|---|
| A1 native new Save As | NOT RUN | | |
| A2 revision/checkpoint | NOT RUN | | |
| A3 refuse existing Save As | NOT RUN | | |
| A4 external Notepad change | NOT RUN | | |
| A4 dual-window/cross-profile extension | NOT RUN | | |
| A5 OS picker cancellation | NOT RUN | | |
| A6 read-only/exclusive lock | NOT RUN | | |
| A7 corrupt JSON rejection | NOT RUN | | |
| A8 unsaved leave-page dialog | NOT RUN | | |
| B1 installed-page SW control | NOT RUN | | |
| B2 PWA installation/icon/window | NOT RUN | | |
| B3 real offline cold reopening | NOT RUN | | |
| B4 user-controlled update | BLOCKED | Separate approved changed-build test deployment required | |
| C1 Firefox/Safari/Edge manual flows | NOT RUN | | |
| C2 8GB Windows, 40 devices+60 walls, 100 ms drag-frame limit | NOT RUN | | |
| C3 real Android/iPad touch | NOT RUN | | |
| C4 NVDA/VoiceOver + French spoken labels | NOT RUN | | |
| C5 Windows high-contrast/reduced-motion | NOT RUN | | |
| D Ghana/security installation + French content signoff | NOT RUN | | |
| E package/signing/distribution owner decision | NOT RUN | | |

## Defect record (copy for each failure)

**Gate:**  
**Severity (critical / major / minor):**  
**Environment:**  
**Git commit / deployment:**  
**Reproduction steps:**  
**Expected outcome:**  
**Observed outcome:**  
**File hash before → after:**  
**Screenshots/logs:**  
**Impact on recovery or data loss:**  
**Related GitHub issue:**  
**Retest date and result:**  

## Release decision — owner/reviewer only

- Full manual A/B/C/D requirements verified: **NO**
- Package/release/signature choice authorized: **NO**
- Source hash, test evidence and known defects reviewed: **NO**
- Professional/commercial release: **NO-GO (default until formally approved)**

Reviewer signature/date: ___________________________________

> A passed GitHub Actions run may be linked as *supporting automated evidence* in this form, but does not automatically change any physical gate from NOT RUN or PARTIAL to PASS.
