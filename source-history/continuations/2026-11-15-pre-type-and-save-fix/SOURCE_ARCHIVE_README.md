# SecurityLab — Stage 15 offline file integrity continuation (2026-11-15)

This package contains one ACTIVE application (`SecurityLab/`) and inactive historical source (`source-history/`).
There is no account system, database, cloud persistence, deployment, or external service. It contains no test suites, test logs, screenshots, compiled app, or node_modules.

## Changes to active source
- New local project-file format **version 2**: offline SHA-256 checksum for accidental corruption detection; version 1 legacy files remain readable.
- Save As cancellation restores the previously saved state when the project was unchanged.
- Cancelling a project/scenario switch preserves state and updates the UI to avoid a stale selection.
- All ten scenario engines continued to create, simulate, assess and serialize locally in Node; this is NOT React UI acceptance.
- Previous active source has been archived intact in `source-history/stage-15-integration-before-file-hardening/`. All earlier historical sources were retained unchanged.

## Build and acceptance status
Use Node 22.12+ on a connected machine, then from `SecurityLab/` run `npm --prefix frontend-react install` and `npm --prefix frontend-react run build`. The bundle is deliberately NOT in this source-only ZIP. The original npm dependencies cannot be installed in the current environment (registry DNS), and Chromium blocks local, file and data navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. No React runtime, PWA or Windows acceptance is claimed.

This checksum does not authenticate a file or prevent intentional forgery. Use only source from `SecurityLab/`; the historical snapshots are not part of the app build. Release remains **NO-GO** pending owner acceptance.
