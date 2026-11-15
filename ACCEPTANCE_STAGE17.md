# Stage 17 acceptance record (2026-11-15)

Status: **development-verified, NO-GO for production.** Windows 11, Node 24.19, Playwright Chromium and WebKit (headless).

| Gate | Result | Evidence |
|---|---|---|
| Strict TypeScript | PASS | `npm run check` |
| Unit / engine tests | PASS 156/156 | `npm test`: lessons, fault generator, audit, quote, instructor packs, profile packs, floors, i18n, report, packaging, standards, ANPR, CLI, environment, lens, cabling, storage, performance guard, plus all Stage 16 suites |
| Scenario completion (engine) | PASS | All 15 scenarios: CCTV x6, alarm x3, access x2, fire, ip-network, solar, market kiosk; none completes without learner actions |
| Production build | PASS | `npm run build` |
| Reproducible package | PASS | `npm run package` -> unsigned zip, `SHA256SUMS.txt`, manifest; two runs give the same hash (test) |
| Browser end-to-end, Chromium | PASS 34/34 | `npx playwright test`: startup, offline reload, 15 scenarios, every console tab, files, tools, floors, language, mobile/touch emulation, axe on every tab |
| Browser end-to-end, WebKit | 24 of 25 | App/UI/Tools suites. FAIL: offline reload with service worker (Playwright WebKit crashes on `setOffline` reload; app vs harness not established) |
| Firefox | BLOCKED | Browser fails to launch in this environment (`spawn UNKNOWN`) |
| Performance guard | PASS | 107-device project: about 16 ms per simulation, 32 ms for review + report + quote on this machine (not an 8 GB benchmark) |
| GitHub Actions | see PR / branch checks | Workflow runs typecheck, tests, build, e2e on ubuntu-24.04 |

## Defects found and fixed during Stage 17
1. Loading a worked example was not written to the audit trail (the main shortcut signal). Fixed.
2. Language select kept an English accessible name after switching language. Fixed.
3. CLI `connect` could attach to the wrong device on an ambiguous name prefix. Now refuses and asks for the full name.
4. Floating-point `tan()` rounding added a spurious camera in `camerasForWidth`. Fixed with an epsilon (test).
5. Console log panels were not keyboard-focusable (found in Stage 16 QA).

## Not verified (see docs/MANUAL_ACCEPTANCE.md)
Real OS file pickers and disk writes; installed-PWA restart offline; Firefox, real Safari/Edge, Android/iPad touch; 8 GB Windows
benchmark; screen-reader testing; native-speaker review of French; Ghanaian technician review of scenarios, rules and formulas;
code-signing and any publishing. No deployment, release or paid-service action has been taken.
