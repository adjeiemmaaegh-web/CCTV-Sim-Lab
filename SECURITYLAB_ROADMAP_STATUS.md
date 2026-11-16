# SecurityLab roadmap and acceptance status (16 November 2026)

**Authoritative released-source baseline:** `main` commit `af883b33bf00b5bfa0d81a9b0bb19e35a4600acb` at the start of the reliability increment; subsequent commits must be read from GitHub. The active application is `SecurityLab/frontend-react` with simulation/domain code in `SecurityLab/src`. `source-history/` is preserved history, **not** active build input. The Vercel public address is an educational preview, **not** certification or professional acceptance.

| Workstream / stage label | Verified engineering evidence | Acceptance status |
|---|---|---|
| Stages 1–15 | Source integrated with historical snapshots preserved | Inherited development; not independently certified |
| Stage 16 | Build/typecheck/Chromium and local-file test-double checks documented in `ACCEPTANCE_STAGE16.md` | Real-disk/PWA/device acceptance open |
| Stage 17 | Twenty additive offline-first tools and educational scenarios described in `docs/FEATURES_STAGE17.md` | Technical content, i18n and hardware acceptance open |
| Stage 18 | Canvas-first workstation and regression coverage (`ACCEPTANCE_STAGE18.md`) | Preview only; visual/manual acceptance open |
| Stage 19 / UX benchmark | Task-based Packet Tracer comparison and canvas usability changes (`docs/SECURITYLAB_PACKET_TRACER_WORKFLOW_BENCHMARK.md`) | Not parity or hands-on Cisco product testing |
| Stage 20 / virtual wiring | Port assignment and cable inspector (`docs/STAGE20_INSTALLATION_WIRING.md`) | Virtual simulation only; no physical cabling approval |
| Engineering stages 3–4 | Five-step optional task strip and evidence-linked diagnostics (`docs/STAGES_2_3_4_ENGINEERING_HANDOFF.md`) | Source and simulated tests; learner/technician acceptance open |
| First-page UX continuation | Merged PR #7, commit `af883b33bf00b5bfa0d81a9b0bb19e35a4600acb`; onboarding and adjustable panels | CI verified; real-device UX acceptance open |
| Reliability-hardening increment | Draft PR #8, branch `reliability-hardening-2026-11-16`: pure import validation, accepted-project extension activation, origin-wide write lock, race/fault tests | **Under engineering review**; unmerged, no release acceptance claimed |

## Required completion gates (do not infer PASS from a code change)

1. Preserve project JSON compatibility and independently verify corrupted/imported/duplicate pack behavior without registry side effects.
2. Browser file saves: run native physical-drive and two-editor collision/recovery checks; the Web Locks API only serializes **cooperating same-origin editors**, not different origins, profiles, applications or OS processes.
3. Execute all `docs/MANUAL_ACCEPTANCE.md` criteria: Windows A1–A8; installed/offline PWA B1–B4; cross-browser, phones, low-memory hardware and accessibility C1–C5; professional content/French review D; and owner release/packaging approval E.
4. Keep qualifying screenshots, device specifications, checked files/hashes, dates, browser versions, logs, and reviewer identities; failures become traceable defects.
5. Re-run the exact final-source CI and independently assess accepted use before authorizing a full release or professional-training claims.

**Design constraints:** no backend, accounts, hosted project database, telemetry, live device control or invented firmware compatibility; local user-owned JSON projects; free educational simulator only. None of the draft remediation changes authorizes a deployment or a merge.
