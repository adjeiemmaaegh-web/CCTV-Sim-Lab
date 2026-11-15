# Stage 18 acceptance record: workstation redesign (2026-11-15)

Status: **public educational preview deployed; professional training, certification and real-installation acceptance remain NO-GO.** Stage 18 was merged into `main` after CI and browser preview checks. This document records engineering verification, not field certification.

## What changed
New shell matching the supplied design: left navigation rail (Equipment, Network, Alarms, Access, Power, Scenarios, Assessment, Settings, Help),
top bar (scenario, mode, live status chips, Assess Installation, Project menu), Equipment Library with collapsible categories and device cards,
canvas with view tabs, icon toolbar, zoom overlay and scale bar, Device Properties panel with General / Coverage / Network tabs and close button,
bottom dock (Realtime, Events, Diagnostics, Power, Access, Console, Tools, More) with a Realtime dashboard, and a footer disclaimer.
All engines and file handling are unchanged; every action that existed before is still reachable.

| Gate | Result |
|---|---|
| Strict TypeScript | PASS |
| Unit tests | PASS 156/156 |
| Chromium end-to-end | PASS 43/43 (existing suites updated for the new controls, plus 9 new shell tests) |
| WebKit end-to-end (app, UI, tools, shell) | all PASS except offline reload with service worker (same Playwright-WebKit crash as before) |
| Axe accessibility (WCAG 2 A/AA) | no serious/critical violations on the main screen or any dock tab |
| Layout at 1920x1080, 1672x941, 1440x900, 1366x768, 1280x720 | no horizontal overflow, canvas at least 240 px high, footer visible (test) |

## Where the design could not be matched literally
- **Logical view tab**: the app has Floor Plan and Network Topology only; no Logical view was invented.
- **Grid selector** ("Grid: 10 units/m"): grid snapping is a checkbox; plan scale is set in Tools > Plan scale.
- **Mounting height, Location, Power fields** on a camera: the data model has no such fields; Coverage tab shows orientation, field of view and range.
- **Play button**: it runs the real virtual recording clock (one virtual minute per second, at most 60 minutes), not an open-ended simulation. It starts paused.
- **Window controls** in the mock-up are operating-system chrome, not part of the web app.
- Night and AC power switches sit under the toolbar; Language and autosave are in Settings; Floors are under Layers & tools until a second floor exists.

## Defects found and fixed while rebuilding
1. The More menu in the dock was clipped and unclickable (overflow hidden on the dock). Fixed.
2. Top bar content overflowed on 1672 px screens and hid the left rail when scrolled. Fixed (shrinkable controls, no programmatic scroll).
3. A view button lost its accessible name when its label was hidden on short screens. Fixed with explicit labels.
4. Notifications covered the dock indefinitely. They now dismiss after 12 seconds.
5. Library categories rendered side by side on phones (legacy rule). Fixed.

## Still open
Same as Stage 17 plus: manual look-and-feel review against the mock-up by the owner, and the unverified items in `docs/MANUAL_ACCEPTANCE.md`.

## Post-Stage-18 UX and dependency continuation (15 November 2026)

A follow-on branch `stage18-ux-hardening` addresses reproducible issues found against the
live Stage 18 preview. The prior screenshot matching is approximate rather than pixel-identical.

- Desktop editing toolbar stays on one horizontal row. Previously at 1024 × 768 it occupied
  about 231 px of height, leaving approximately 239 px for the canvas; the revised 1024 px
  preview shows approximately 67 px for the toolbar and 403 px for the canvas.
- A keyboard-accessible **Focus canvas / Restore workstation panels** control maximizes
  the drawing workspace without deleting the project, changing tools, or discarding selections.
  In the 1024 × 768 preview, focus expands the canvas to approximately 916 × 575 px.
- Mobile layouts present the floor-plan workspace before the equipment catalog, and the header
  uses a compact three-row arrangement instead of a long stack of controls.
- Rail selection follows the actual active dock tab, rather than showing a stale highlight.
- Unconfigured or unlinked networks are no longer incorrectly described as "Online".
- Dependency audit repair: Vitest is upgraded to 5.1.0, fflate is locked at 0.8.3,
  and CI runs `npm audit --audit-level=moderate` across all dependencies.
  The audited candidate passed TypeScript, unit tests and build before its manifests
  were committed; normal branch CI must also pass on the final committed lockfile.
- New browser regression tests cover toolbar height, focused canvas placement and restoration,
  mobile first-screen canvas visibility, navigation state and empty-network indicators.

**No authorization or evidence of field certification:** The static site remains a
training simulator with no accounts, browser project database, backend or remote telemetry.
The project must not be used to certify real installation compliance, manufacturer
interoperability, or an installer’s professional competence. The human checklist in
`docs/MANUAL_ACCEPTANCE.md` remains mandatory. Native Windows file pickers, installed-PWA
restart with Wi-Fi disabled, physical-device/8GB performance, Firefox/Safari real-browser
acceptance, touchscreen hardware, screen-reader assessment, French review, and qualified
Ghanaian installer review are all still OPEN.
