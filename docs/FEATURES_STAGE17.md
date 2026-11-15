# Stage 17 features (20 requested upgrades)

All features are offline, file-based and additive: existing projects open unchanged. Engines are pure code under
`SecurityLab/src/tools` and `SecurityLab/src/engine`; panels live under **Tools** in the simulation console.
"Tested" lists the automated coverage. "Limits" is what the feature honestly does NOT do.

| # | Feature | Where | Tested | Limits |
|---|---|---|---|---|
| 1 | Network CLI | Tools > Network CLI (`tools/cli.ts`) | `cli.test.ts`, e2e | A small Cisco-flavoured subset (VLANs, trunks, DHCP pools, routes, addressing, show, ping). Not IOS. Edits the same fields as the forms. |
| 2 | Packet trace | Tools > Packet trace | `cli.test.ts` | Explains the simulation's decision hop by hop; no real packets. |
| 3 | Camera view | Tools > Camera view | `engineering-tools.test.ts` | Schematic ray-cast strip, doors/windows see-through, not video. |
| 4 | Lens calculator | Tools > Lens calculator | unit | px/m bands detect 25 / observe 62 / recognise 125 / identify 250; training guidance. |
| 5 | Cable engineering | Tools > Cabling | unit | Copper drop, PoE delivery, 100 m / coax limits. No wire-map/termination fault model. |
| 6 | Storage + RAID planner | Tools > Storage | unit | RAID 0/1/5/6/10 capacity and failure tolerance; duty factors are assumptions. |
| 7 | Environment effects | Tools > Environment; `engine/environment.ts` | unit, e2e | Heuristic range/PIR/battery factors, applied in simulate, motion and alarm detection. |
| 8 | Guided lessons | Tools > Lessons | unit, e2e | 4 lessons; progress is derived from the engines, never self-reported. |
| 9 | Seeded fault generator | Tools > Fault exercise | unit, e2e | Reuses the 14 engine fault injectors; deterministic per seed. |
| 10 | Instructor mode | Tools > Instructor | unit, e2e | Local scenario packs, equipment lock, class CSV. No accounts or cloud, by design. |
| 11 | Audit trail / replay | Tools > Audit trail | unit, e2e | Summarises real before/after state; capped at 400 entries; flags worked examples. |
| 12 | Quotation / BOM | Tools > Quotation | unit, e2e | User-entered prices; manufacturer models need a quotation; CSV/HTML export. |
| 13 | More system types | Equipment Library | `scenario-completion.test.ts`, `standards-anpr.test.ts` | Fire detectors, call point, sounder, fence cable, ANPR camera + check tool, door station, intercom release, gate operator. Fire model is a radius model, not EN 54. |
| 14 | Good-practice checklists | Tools > Good practice | unit, e2e | Four selectable sets, no clause numbers, explicit disclaimer. Not compliance. |
| 15 | More scenarios | Scenario list | unit, e2e | 11-15: school, hospital ward, market kiosk (GH), church compound (GH), office fire. Not yet reviewed by Ghanaian technicians. |
| 16 | Multi-floor + plan scale | Canvas floor bar; Tools > Plan scale | `floors.test.ts`, e2e | Up to 9 floors; walls/targets per floor; +3 m cable per floor. Scale calibration is manual; no automatic image measuring. |
| 17 | Touch + printable report | Tools > Report / PDF | `report.test.ts`, `mobile.spec.ts` | Touch emulation tested in Chromium only. PDF is produced by the browser's Print dialog from a standalone HTML report. |
| 18 | Language + read-aloud | Language selector; speaker buttons | `i18n.test.ts`, e2e | English and French for the main chrome, tool tabs, floor bar, lessons and review summary; the rest of the UI is English. French needs native-speaker review. Speech depends on installed browser voices. |
| 19 | Packaging | `npm run package` | `package.test.ts` | Reproducible unsigned zip + SHA256SUMS + manifest. No installer or signing; manual real-disk/PWA checks in `MANUAL_ACCEPTANCE.md`. |
| 20 | Device profile packs | Tools > Instructor | `profile-pack.test.ts`, e2e | Validated format: HTTPS source, edition, facts, limitations; price forced to 0; must attest "not real firmware"; embedded in projects. |

## Added models and fields
`Project.environment`, `diagnosis`, `audit`, `floors`, `customScenario`, `profilePack`; optional `floor` on devices, rooms,
walls, targets and site markers. All are validated in `persistence/validation.ts`.
