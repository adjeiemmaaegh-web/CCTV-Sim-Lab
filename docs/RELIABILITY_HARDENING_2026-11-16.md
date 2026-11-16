# SecurityLab reliability-hardening engineering handoff — 16 November 2026

> **Post-merge correction (17 November 2026):** PR #8 was merged and verified on `main` commit `2ad0a41a1c83b438efe2643666732d5fd3cbb397`; the historical draft/under-review language below describes the engineering handoff **before merge** and must not be interpreted as current state. Main CI [43877160667](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43877160667) passed 171/171 unit and 69/69 Chromium tests. Separate QA [PR #9](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/pull/9) later achieved 76/76 Firefox+Linux WebKit checks, documented in [the acceptance register](ACCEPTANCE_EXECUTION_2026-11-16.md). **Real-device and professional acceptance remain NO-GO.**

**Status:** Engineering increment in draft PR #8, not merged, not released, not professionally validated. **Source baseline:** main `af883b33bf00b5bfa0d81a9b0bb19e35a4600acb`. Final accepted source and CI status must be read from the PR head before any merge. **No backend, telemetry, account, database or cloud project-storage changes.** Existing static Vercel educational preview is unaffected by this branch.

## Scope and changes

### DEF-001 — rejected imported projects changing live model registries

Previous `validateProject()` registered embedded device profiles and custom scenarios in global process-wide arrays *before* all the project fields or file checksum were accepted. `parseProjectText()` could reject a file after those writes. This was a source-supported integrity defect, not proof of observed real-world data loss.

- `SecurityLab/src/persistence/validation.ts`: evaluate embedded device models via pure `buildProfile` and scenarios via pure `buildScenario`; validate references against a temporary combined view, reject duplicate embedded model IDs, and return a validated clone **without** registering anything.
- `activateProjectExtensions()` is the explicit post-acceptance step, with global scenario capacity preflight.
- `SecurityLab/frontend-react/src/hooks/useWorkbench.ts`: `adopt()` first validates, then activates extensions, then installs the project in the editor. File parsing/validation and a stale async `openNative/openFile` that is not adopted cannot register untrusted extensions.
- Existing tests that depended on validation side effects now assert **no side effect** and explicitly activate an accepted project. `SecurityLab/tests/import-integrity.test.ts` covers corrupted checksum, late invalid fields, duplicate embedded IDs and accepted-project activation.

### DEF-002 — non-atomic project-file writing

Previously the read/compare and write were separate asynchronous operations. A stale concurrent editor could pass the first comparison before another editor completed the write.

- `SecurityLab/src/persistence/file-projects.ts`: hold `navigator.locks.request('securitylab:project-file-writer', {mode:'exclusive'})` across read/compare, writable creation, second pre-write read/compare, writing, closing, readback and verification.
- Native verified writes fail closed with a recovery message when browser Web Locks are unavailable. The existing **Export Backup**, **Save As**, **Open**, and file conflict/recovery UX remain available.
- `SecurityLab/frontend-react/e2e/files.spec.ts`: race two same-origin editor tabs against the same origin-private file, require one stale save to be rejected; verify no-lock refusal; inject a staged write failure, require previous bytes unchanged and a downloadable unsaved draft.
- **Explicit limit:** Web Locks are origin- and browser-profile-scoped. They do not lock the OS filesystem, a different Vercel domain, a second browser profile, another browser, a desktop file editor, or external processes. The second read check reduces but cannot eliminate the check/write race against such actors. **Single writer remains mandatory for user-owned files.** Never claim atomic cross-process compare-and-swap.

### Other audit findings

- `TeachingTools.tsx`: a blocked printable-report popup now immediately revokes its unused Blob URL. Existing successful popup revocation after 60 seconds is preserved. This corrects the narrower edge case; the audit's blanket statement that no revocation existed was imprecise.
- `SECURITYLAB_ROADMAP_STATUS.md` and `SecurityLab/README.md`: consolidate current-stage documentation with the fact that physical QA is still open.
- `docs/MANUAL_ACCEPTANCE.md`: add an explicit shared-file collision exercise under existing A4 without silently reclassifying mandatory acceptance results.

## Developer verification

From `SecurityLab/frontend-react` on the exact PR head:

```bash
npm ci
npm audit --audit-level=moderate
npm run check
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run package
```

Use GitHub Actions PR #8 for remote run IDs, source hashes, PASS/FAIL totals and logs. The passing intermediate branch run `43830077546` exercised **170/170 unit tests and 68/68 Chromium browser tests** on Ubuntu 24.04 / Node 22 (plus typecheck, build and npm audit). It is **not** proof of the final PR head if further changes were made, of a native Windows file picker, or of cross-browser/physical testing. Other intermediate CI runs failed while older tests were being updated to the new pure-validation contract; they were not hidden. The final head must pass again.

## Physical acceptance and incident workflow

1. On a Windows 11 machine with real Chrome/Edge native File System Access support, complete A1–A8. Under A4, open the same physical project in two installed app windows/tabs; independently edit both, save in the first, and attempt the second save. The stale save must not silently overwrite. Repeat after an external Notepad modification, and document whether an OS race is reproducible.
2. If a save is blocked or any competing editor changes the selected file, **do not retry blindly**. Export an independent backup of the in-memory draft first; verify that downloaded file's bytes, open the on-disk project separately, reconcile intended edits, and Save As a new file.
3. Validate PWA update/closed-browser offline restart B1–B4, Firefox/Safari/Edge, real Android/iOS touch and screen readers, the 8 GB Windows drag-frame target, native French review and qualified Ghanaian security-technician signoff.
4. Record pass/fail, dates, browser and OS build, exact Git SHA, screenshots/logs and reviewer identity. A failed or unperformed item must remain open.

## Non-goals and release judgment

No claim of hardware certification, actual camera/network traffic, manufacturer integration, electrical safety conformance, multi-process atomic disk CAS, professional competency validation or full product completion. No merge or deployment without owner authorization; formal acceptance is still **NO-GO** pending real-device and content review.
