# SecurityLab — cumulative source through Stage 12

Virtual electronic security engineering simulator. This one source tree contains the React/Vite workstation, framework-independent TypeScript simulation engines, 2D property editor, manufacturer profile registry, ten practical scenarios and assessment/reporting logic from Stages 1–11, plus the Stage 12 file-based project subsystem.

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
