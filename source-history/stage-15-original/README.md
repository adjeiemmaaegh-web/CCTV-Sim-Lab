# SecurityLab — Stage 15 Integrated Source

**Development source consolidated through stages 1–15. This is not a validated production release.**

SecurityLab is a browser-based virtual electronic-security engineering workstation for property layout, CCTV/recorders, IP networking, intrusion alarms, access control, electrical/solar backup, manufacturer-informed virtual profiles, scenarios, and evidence-based practical assessment. This archive includes one **active** application plus exact earlier stage-source snapshots so prior work is not silently removed.

## Source layout

| Path | Purpose |
| --- | --- |
| `SecurityLab/frontend-react/` | Active React 19 / TypeScript / Vite workstation, interactive SVG property editor and console panels |
| `SecurityLab/src/domain/` | Versioned device data types, generic catalogue, and manufacturer-reference profiles |
| `SecurityLab/src/engine/` | Deterministic geometry/CCTV, network, alarm, access, power, assessment, reporting and Stage 15 integrated-health rules |
| `SecurityLab/src/scenarios/` | Ten practical assignment definitions and objective evaluation |
| `SecurityLab/src/property/` | 2D geometry, room and wall editing, openings and templates |
| `SecurityLab/src/persistence/` | Local JSON project opening/saving/validation, checkpoints, image imports |
| `SecurityLab/src/state/` | Reversible project change history |
| `SecurityLab/src/field/` | Offline/manual anonymous field-review records (not actual verification) |
| `source-history/stage-01/` through `stage-14/` | Byte-preserved inactive historical source snapshots; **not part of the application build** |
| `SOURCE_LINEAGE.json` | Audit record of the originally archived Stage 1–14 sources |
| `SOURCE_STAGE15_MANIFEST.json` | Hash/size inventory of current Stage 15 source |

## Core product decisions

- **No sign-in, accounts, hosted API, cloud sync, PostgreSQL, Supabase or IndexedDB project database.** No module of the active application writes learner data to a service. Historical Stage 1–11 sources may contain withdrawn database implementations: they are inert and deliberately excluded from build paths.
- Learners save/open portable `.securitylab.json` files. In compatible Chromium-derived browsers, the File System Access API can write a chosen file and verify readback; other browsers initiate JSON downloads without pretending the data was durably saved. The user must retain each downloaded file.
- The service worker, when built and run on an eligible secure origin, caches **application shell assets only**. It does not store projects. `file://` does not provide a fully working installable PWA.
- Simulated camera views, events, manufacturers and credentials are educational representations, not real firmware, playable CCTV footage, electrical safety certification or professional licensing.
- This repository is free of hardcoded credentials, online account requirements and external premium API dependencies.

## Stage 15 integration changes

1. **Independent project-file loading**: File pickers and file reads complete into a separate temporary session. Edits made during asynchronous reading prevent an older result from overwriting the active project.
2. **Safe worked examples**: Loading the assisted example detaches the previous file and starts a separate unsaved draft. It can no longer quietly replace the content of the learner's previously selected project file.
3. **Safe reload**: File read and validation finish before changing active file tracking, and edits made during a reload are preserved.
4. **Explicit save semantics**: An imported JSON with no writable handle cannot claim a new verified save simply because its content matches the opened file. The browser fallback initiates a new JSON download and warns the learner.
5. **Integrated system overview**: A new `Systems` console tab derives live diagnostic summaries from the existing CCTV, network, alarm, access, power, and scenario engines. Counts and warnings are computed from project state, not separate UI-only animation flags.
6. **Cumulative source-preservation**: The Stage 1–14 historical snapshots and their original SHA inventory are retained unchanged, while the Stage 15 active project is a clearly identified single source tree.

## Development build instructions (not yet executed/accepted)

You will need a connected development computer with Node.js **22.12 or newer** and npm. From `SecurityLab/`:

```bash
npm --prefix frontend-react install
npm --prefix frontend-react run check
npm --prefix frontend-react run build
npm --prefix frontend-react run preview
```

The `build` step emits static files into `SecurityLab/dist-react/` and generates a service worker that precaches that build's static assets. The delivered ZIP **contains only source/configuration and history**; it intentionally does not contain `node_modules`, generated build output, tests, screenshots, CI logs, QA reports or real user project files. An authenticated npm lockfile was not verified in the local environment; it must be generated and reviewed on a connected build machine before using `npm ci` for a release.

Do not import code from `source-history/` into the active application; it contains superseded and rejected implementations. Do not deploy to Vercel, GitHub or a public domain without explicit owner authorization and acceptance.

## Remaining acceptance gates

Stage 15 source integration is a **development deliverable**, not commercial or production acceptance. The following remain open: authentic dependency installation and React/Vite build, application-origin save/reopen and offline-PWA behaviour, multi-browser and 8 GB Windows performance, correct operation and troubleshooting of all ten scenarios, accessibility and security checks, real technician/learner field validation, and explicit owner release authorization.

No tests or user studies were performed as part of this Stage 15 **source-only** handoff. Compiler-only source checks and ZIP-file integrity verification do not replace functional acceptance.
