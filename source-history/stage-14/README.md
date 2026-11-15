# SecurityLab — cumulative source through Stage 13

Virtual electronic security engineering simulator. This one source tree contains the React/Vite workstation, framework-independent TypeScript simulation engines, 2D property editor, manufacturer profile registry, ten practical scenarios and assessment/reporting logic from Stages 1–11, the Stage 12 file-based project subsystem and the Stage 13 hardening changes.

## Non-negotiable product scope

- **No sign-in, accounts, cloud services, PostgreSQL, Supabase, IndexedDB or browser-local project database.** No internet is required for simulation after the app's assets are available offline.
- Projects belong to the learner as editable, portable `.securitylab.json` files. Opening a project does **not** upload it anywhere.
- The browser's PWA `CacheStorage` stores *only application shell assets*, not projects or assessments. This cache is not a user-data database.
- There is no automatic cross-session project restoration without opening a project file. This is deliberate: there is no hidden storage.

## File workflow

1. Open the workstation and choose **New** or one of the built-in scenario layouts.
2. Select **Save Project** to choose a local JSON file. In browsers implementing the File System Access API on a secure origin, writes are checked with a local-file readback before the project is marked **Saved**.
3. Subsequent **Save Project** writes to the same chosen file. **Save As** creates a separate file. Optional **Autosave to file** is available only when the user has selected a writable local file and permission remains granted.
4. **Open JSON** opens a project from disk. **Import Copy** imports an independent, unsaved copy and assigns a new project ID.
5. **Export Backup** initiates a separate JSON download, and **Checkpoints** lists earlier snapshots embedded inside the last verified project file. Checkpoints are bounded; independent backups remain advisable.
6. Where native file writing is unavailable, Save/Save As initiates a JSON download. The app **does not claim a successful durable save** in this fallback mode: users must verify the downloaded file. Every subsequent save requires retaining the new download.

Legacy raw SecurityLab JSON exports (schema versions 1 or 2) can be imported into Stage 12. For users with projects trapped in the previous Stage 1–11 IndexedDB edition, export them from that older edition first. **Stage 12 does not read, migrate or delete browser databases.**

### Data integrity and limitations

- Each saved project file contains the project, revision metadata, a small bounded history and an accidental-corruption checksum. This checksum is **not a cryptographic signature** or professional assessment attestation.
- Existing-file writes check for unexpected external changes before overwriting and then read back after closing. This is **not an atomic cross-process lock**; simultaneous editors can still race. Use separate files when working in multiple tabs or applications.
- File writer permissions may expire after browser restart. Reopen the JSON file before continuing. No persistent handles are stored.
- Crash recovery is limited to a previously confirmed project file and its embedded checkpoints, or to a separately downloaded backup. Unsaved in-memory edits may be lost on a crash or browser close.
- Assessment results are local simulations, not certified competency or manufacturer firmware behaviour.

## Development commands

Install frontend dependencies on a connected development machine and use `npm run dev` from the repository root. `npm run build` produces the static Vite site and PWA cache script. Install dependencies with `npm --prefix frontend-react install` first. Node 22.12+ is recommended. This delivery contains **source only** and no compiled artifacts or test suite. A full production React build and real-browser acceptance have not been verified in this delivery.

The static site is suitable for local hosting or later static deployment, but *no deployment was performed or authorized*.

## Stage 13 — Source hardening increment

This cumulative source tree includes all Stage 1–12 laboratories and the Stage 13 improvements:

- **File-change safety:** selected-file overwrites compare the **entire previously read file content** with the current file before writing (rather than relying on the earlier 32-bit comparison hash). Saves still require a successful readback; simultaneous cross-process writes are **not** atomic and remain a documented limitation.
- **Portable file limits:** project serialization and imports enforce a 16 MB **UTF-8 byte** ceiling, including embedded revision checkpoints. Generated filenames are sanitized against reserved Windows device names. Legacy Stage 12 JSON file/checkpoint formats remain readable.
- **Floor-plan import hardening:** verify PNG/JPEG/WebP signature and successful image decode, enforce 2 MB compressed-size and 24-million-pixel limits, reject unsupported image content, and refuse to overwrite a project that changed during asynchronous image decoding. Images remain locally embedded in project JSON; nothing is uploaded.
- **Keyboard accessibility:** skip-to-workspace link, keyboard element navigator for devices/rooms/walls, center-placement and center-room/wall creation actions, selectable topology nodes, arrow-key nudging, visible focus outlines, and keyboard-contained checkpoint dialog with Escape/Tab handling.
- **Editor performance/compatibility:** cached device and camera-coverage lookups for the installation canvas; native non-passive wheel handler to avoid Chrome passive-listener problems; stable global keyboard listener; small-screen, reduced-motion and forced-color styling adjustments.
- **Safe export workflow:** downloadable project JSON is still **not** labelled a confirmed durable save unless the native File System Access API verifies a write/readback. The browser's PWA cache stores application assets only—not user project files.

### Boundaries

Stage 13 is a **source-only increment** and has not received functional, browser, security, accessibility or field acceptance. The React/Vite runtime build remains unverified. An offline PWA can be installed only from an eligible secure HTTP origin; `file://` will not provide the full PWA feature set. Stage 13 does not create an account, database, service endpoint or cloud synchronization feature. The source is intended for later acceptance and real-device review before any production release.

## Stage 14 — Anonymous field review and release-candidate support (source only)

Stage 14 adds a **Field Review** tab to the offline desktop workstation. This is a review-workflow implementation, **not** evidence that any actual field study, software validation, production build or release approval has occurred.

### How to use it during a future supervised field review

1. Open a SecurityLab project file and use **Field Review** to prepare a practical observation. Select an anonymized role (learner, technician or instructor), the browser and device specification, the scenario, the concrete task, and the actual observed outcome.
2. Repeat the task with the appropriate field reviewer. Enter results **only after observing them**, including whether the exercise was performed without internet. Never mark an exercise completed solely on simulation output.
3. Record each defect with its severity, reproduction steps, expected and observed behaviour. Status changes are manually entered; the app does **not** verify that a reported issue was truly resolved.
4. Use **Export anonymous field review JSON** or **Export printable field review** to share a report without disclosing project equipment configuration, access credentials or floor-plan images. These exports initiate browser downloads and require manual retention.
5. **Save Project** to keep review records inside the local `.securitylab.json` file. Unsupported browsers may need explicit downloads; only a native write/readback can show confirmed save.

The field-review data model is additive and optional (`Project.fieldReview`). Stage 1–13 project JSON files retain compatibility. Field session entries are limited to 120 and findings to 120 per project; notes are bounded. No names, contact details, usernames, real biometrics, passwords or certificates are requested. User-entered notes are still untrusted and are HTML-escaped in exported reports.

The preparation dashboard shows manually reported coverage for nine target workflows, all ten scenarios, three reviewer-role categories, offline use, affordable-PC use and closure of critical/major findings. It **never declares production ready**, even if all observations are marked completed. These entries are editable local user data, not independent verification, signed evidence or a licensing attestation.

### Outstanding Stage 14/15 acceptance (NOT performed)

- Authentic `npm ci` and React/Vite production build with a reviewed, committed lockfile.
- Chrome/Edge/Firefox/Safari checks on approved browser origins, including Save/Save As, JSON round trip and offline PWA behaviour.
- Independent simulation correctness, migration, performance, security and WCAG 2.2 AA acceptance.
- Real 8 GB Windows field sessions with Ghanaian learners, technicians and instructors and recorded issue resolutions.
- Owner review and express release/deployment authorization.

**No test suite was run, no user trial was conducted, and no deployment was made for this source-only delivery.** Stage 15 production release remains NO-GO pending acceptance.
