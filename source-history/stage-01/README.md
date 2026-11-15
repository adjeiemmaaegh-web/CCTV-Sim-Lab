# SecurityLab — Virtual Security Engineering & Installation Simulator

**Build:** Stage 1 Engineering MVP · **Date:** 14 November 2026 · **Status:** Prototype / local simulator; not production-certified.

SecurityLab is a hands-on, offline-capable web workstation for learning CCTV placement, cabling, IP addressing, PoE power engineering, NVR recording, fault troubleshooting and practical assessment. It is **not** an LMS, video player, manufacturer firmware or hardware integration system.

## Start the prebuilt simulator (no dependency download)

The ZIP contains a complete compiled `dist/` folder. Extract the folder, open a Terminal/PowerShell in the `SecurityLab_Stage1_MVP` directory, then:

```sh
node scripts/serve.mjs
```

Open **http://localhost:4173** in Chrome or Edge. Node 20+ is required for this local web server. The simulator itself runs entirely in the browser and does not call an external API. Avoid directly opening `dist/index.html` using `file://` because browser ES-module and service-worker policies vary by browser.

To stop the server, press Ctrl+C in the terminal. To run a different port, set the `PORT` environment variable before launching.

## Rebuild from TypeScript source

On a computer with npm registry access:

```sh
npm install
npm run check
npm run build
node --test tests/*.test.mjs
npm run serve
```

An authentic `package-lock.json` was **not** generated during this delivery: npm registry DNS access was unavailable in the build container. The delivered `dist/` was compiled using installed TypeScript 5.8.3 and is included in the ZIP. The `package.json` pins a future development dependency to TypeScript 5.9.3; it is not yet lockfile-verified. Run `npm install` on a connected development machine, commit its real lockfile, run `npm ci` in CI and recheck before deploying. Do not fabricate a lockfile.

## How to use

1. Select one of three exercises from the scenario selector: four-camera home, retail shop or diagnose failed CCTV.
2. Click or drag a device from the left equipment catalogue onto the plan; the property includes named objectives (orange = uncovered, green = covered).
3. Choose **Cable** and click a camera and a PoE switch; connect the switch to the NVR. Network status follows actual simulated power, cable, IP and recorder rules.
4. Select equipment or a cable, then edit values on the right: IP, subnet, heading, FOV, PoE budget, storage, enabled switches, cable length, and plug state.
5. Choose **Test motion** then click a visible area. The event console shows whether a camera detected movement and whether an NVR clip was successfully stored.
6. Select **Inject fault** from the left, observe Diagnostics, actually repair the changed configuration and rerun the test.
7. Select **Assess installation** to receive evidence-based 0–100 scoring and a locally saved attempt record. Worked examples are useful for learning but capped at 75, below the pass threshold.
8. **Save project** to the browser's IndexedDB, **Open** saved projects, **Export** portable JSON, or **Import** JSON as a separate copy. Export backups before clearing browser data.

Additional tools: draw a wall or room by click-dragging on the plan; select a wall and change it to a door/window (simplified transparent openings); import a PNG/JPEG/WebP reference floor plan (≤2 MB); zoom with mouse wheel/toolbar, pan with Pan tool, switch to Network topology, toggle night mode or AC power, delete selected objects with Delete.

## Scenario design

| Exercise | Expected outcome | Initial equipment | Faults |
| --- | --- | --- | --- |
| Four-camera home | Four online recording cameras, entrance/driveway/garden/passage coverage, event evidence, within GHS 5,000 | Empty | Can inject |
| Retail shop CCTV | Three online recording cameras, entrance/cash/stockroom coverage, within GHS 4,000 | Empty | Can inject |
| Diagnose failed CCTV | Restore four cameras and four targets, produce an NVR recording, assess with ≥80 | Prewired faulty | Disconnected cable + duplicate IP |

Training costs and ranges are **illustrative**, not live Ghanaian retail prices or real equipment specifications. Distances are schematic; default grid units approximate metres at 10 plan units per metre. Some objectives may remain uncovered until you install operational equipment and aim cameras correctly.

## Project contents

- `src/domain/` — simulation document and device profile schema.
- `src/engine/` — pure deterministic geometry, network, PoE, recorder, fault and assessment rules.
- `src/scenarios/` — three exercise definitions, independent of UI.
- `src/persistence/` — IndexedDB CRUD and import validation.
- `src/ui/` — first working TS/SVG desktop editor.
- `tests/engine.test.mjs` — Node engine and validation tests.
- `tests/embedded-browser-smoke.py` — reproducible **opaque-origin** UI test harness (not storage/PWA acceptance).
- `db/schema.sql` — proposed cloud tables, grants and RLS (not migrated to a database).
- `docs/` — architecture A–H, vendor research, browser acceptance protocol, QA evidence.
- `dist/` — precompiled static app and PWA shell; Vercel static output.
- `vercel.json` — example configuration for future static deployment; **no deployment performed**.

## Architecture decision and limitations

To prioritize a demonstrable engine under unavailable npm dependencies, the **Stage 1 UI is native TypeScript/SVG**, not yet React, Konva or React Flow. The UI is a replaceable adapter over the independent engine, enabling React Flow/Konva integration later without rewriting core rules. This is a deliberate architectural compromise, not hidden framework compliance.

This simulator implements conceptual teaching rules, **not** full physical compliance: no actual ONVIF/RTSP stream, no real recording video, no CCTV mounting height/illumination or precise optical model, no VLAN/DHCP/routing, no actual manufacturer firmware, no UPS/solar, no alarms/access control yet, no online accounts, and no secure graded certification. A 100-metre generic copper-Ethernet limit is modeled; exceptional long-distance/Extend modes require later specific implementations. Night-mode range is a generic multiplier. These approximations are documented in `docs/ARCHITECTURE.md` and `docs/DEVICE_PROFILE_RESEARCH.md`.

## Test and release status

- Compile: TypeScript build PASS using global tsc 5.8.3.
- Unit tests: 29/29 PASS (zero failures/skips).
- Interactive embedded Chromium DOM test: PASS for placement, cables, IP edit, topology, wall/room drawing, event/assessment/fault flows; uses `page.set_content` with inline ES modules and a UUID shim because opaque-origin contexts lack `crypto.randomUUID` and IndexedDB.
- Normal-origin Chromium navigation: **BLOCKED by `ERR_BLOCKED_BY_ADMINISTRATOR`** in the execution environment.
- Actual IndexedDB save/reopen, real-origin service-worker offline behavior, Chrome/Edge/Firefox/Safari acceptance, field/hardware tests, cloud RLS tests and Vercel deployment: **NOT VERIFIED**.
- Commercial/student release: **NO-GO** until appropriate browser, privacy, licensing and educational acceptance gates close.

See `docs/BROWSER_ACCEPTANCE.md` for a reproducible checklist. This repository contains no secrets or required API keys.
