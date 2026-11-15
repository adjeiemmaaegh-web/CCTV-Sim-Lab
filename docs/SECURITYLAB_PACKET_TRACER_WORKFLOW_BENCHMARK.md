# SecurityLab vs Cisco Packet Tracer — task-based UX benchmark

**Date:** 2026-11-15  
**SecurityLab source baseline:** `main` commit `8d5b1ebb085ec01c4d03fa2b5468d794bd13fb9d`; Stage 19 continuation on `stage19-ux-comparison`.  
**Product scope:** Offline-first browser-based *security-system installation* education, not a replacement for Cisco IOS, a networking certification, or professional installation approval.

## Method and evidence limits

1. Packet Tracer expected behaviors were derived from **Cisco's published Packet Tracer help** and user-interface explanations, not from a hands-on Packet Tracer installation. No Packet Tracer executable, instrumented session or direct time-on-task/user-study data was available. This is a **documentation-grounded comparative inspection**.
2. SecurityLab tasks were actually exercised in a remote Chromium browser against the Vercel preview `https://securitylab-7l1aedrf0-emma-0cc9.vercel.app/` (branch commit `5508c933f9fd95dea13736ed59bfb975ce4761d7`). This preview includes the canvas-first UX changes but predates the final `main` audit-only dependency updates. The public production URL was still on the prior Stage 18 build at the start of this audit because of the Vercel free-plan deployment quota.
3. The five-task regression is captured in `SecurityLab/frontend-react/e2e/comparison.spec.ts`. It verifies the cumulative workflow in automated Chromium using an *origin-private file-system test double*, not an actual Windows file picker or real CCTV equipment.
4. The user's reference design is a visual target for a **canvas-dominant** workspace and sensible navigation; it does not authorize copying Cisco logos or claiming protocol compatibility.

## Five practical tasks, inspected side by side

| Practical task | Cisco Packet Tracer reference workflow | SecurityLab observation in Chromium preview | Result / limitation |
|---|---|---|---|
| **1. Place devices** | Select a device family and model, then click or drag to the logical workspace. | A generic IP Bullet 2MP camera and a 4-Port PoE+ switch were placed from the grouped Equipment Library; two device icons appeared. | **PASS** for SecurityLab placement; no empirical Cisco task timing. |
| **2. Connect devices** | Select a cable, choose device interfaces/ports at both ends; link status becomes observable. | Cable toolbar, camera click, switch click created one virtual Ethernet link with explicit confirmation. | **PASS** for simple cable creation; **GAP**: connection medium auto-selected without the same explicit per-endpoint interface picker. |
| **3. Configure device** | Click device, use GUI configuration tabs or suitable IOS-like CLI for network equipment. | Clicking the camera opened the contextual inspector; Network tab IP Address accepted `192.168.10.44`. Separate SecurityLab CLI supports a deliberately limited simulated command subset. | **PASS** for modeled fields; **GAP**: not equivalent to Packet Tracer's interface/module/IOS breadth. |
| **4. Diagnose a fault** | Realtime/Simulation views, PDU/event controls and packet-step inspection help trace network behavior. | Diagnostics → fault type `disconnect` → Inject Fault produced visible `Cable disconnected`, `No usable Ethernet cable`, and loss of PoE feedback. | **PASS** for *structured simulator diagnoses*; **GAP**: not protocol-level packet animation, event filters or full OSI packet inspection. |
| **5. Save and reopen** | Native PKT/PKZ project file commands; save portable topology/resources. | Browser File System Access test double saved a project, updated it to revision 2 with one checkpoint, switched scenario, and reopened the original saved scenario successfully. | **PASS** in browser-origin simulation only. **OPEN**: actual Windows OS file picker/save/restart and installed offline app. |

Cisco documentation references: [Interface Overview](https://tutorials.ptnetacad.net/help/default/interfaceOverview.htm), [The Logical Workspace](https://tutorials.ptnetacad.net/help/default/workspace_logical.htm), [Simulation Mode](https://tutorials.ptnetacad.net/help/default/mode_simulation.htm), [The Physical Workspace](https://tutorials.ptnetacad.net/help/default/workspace_physical.htm).

## UX observations and source fixes

### High priority — focus-mode navigation

**Reproduced defect:** In canvas-focus mode, clicking Equipment or Network changed the internal tab while catalog/console remained hidden; clicking **Assess Installation** recorded a local result but left the assessment panel invisible. The controls appeared to do nothing.  
**Correction on Stage 19 branch:** Top-bar assessment and left-rail section commands explicitly restore normal workstation panels before selecting the tab; canvas Focus/Restore control remains available. Regression test checks Equipment, Network and Assessment transitions.

### Cable-workflow clarity

Previously, selecting the Cable tool displayed generic engineering notes even after the first endpoint had been chosen. Stage 19 now supplies a first-device prompt and a second-device prompt, and Escape resets any partly selected connection. A new browser regression asserts these transitions.

### Workstation layout

A 1600×900 browser screenshot of the prior UX-hardened preview in Focus canvas mode showed a 1472×717 drawing canvas, with visible editing tools, left navigation and project footer. At 1024×768 the earlier post-Stage-18 measurement was 403px of canvas height in normal mode and 575px in focus mode. These are screenshot/browser layout measurements, **not an accessibility or preference study**.

### Priority queue (not claims of implementation)

1. **P1 — discoverability:** The Stage 19 change adds step-specific first/second cable endpoint prompts and Escape cancellation. Further context-sensitive guidance on *simulated* connectivity, power and recording diagnostics still needs real learner review.
2. **P1 — interaction quality:** Test project creation, undo, navigation, small-screen focus switching and panel discoverability with actual learners. Do not infer human ease-of-use from scripted test execution speeds.
3. **P2 — inspectability:** A future explicitly scoped UX change could offer cable endpoint/port information as a selectable inspector without pretending the engine already models Packet Tracer-style modular hardware.
4. **Separate engineering scope decision:** Full packet-by-packet PDU simulation, IOS command coverage, physical rack/module graphics and dynamic protocols are **not** part of this targeted UX fix. They require independent requirements, modeling, tests and agreement on scope.

## Acceptance ledger

| Gate | Status |
|---|---|
| Cisco documented UX/workflow comparison | **Complete** (documentation-grounded, not hands-on Cisco A/B testing) |
| SecurityLab live-preview place/connect/configure/diagnose | **PASS** in remote Chromium |
| Save, revision, checkpoint and reopen | **PASS** using browser-origin file-handle test double |
| Reproduced focus-navigation bug | **PASS** on Stage 19 branch; browser regression verifies rail, inspector and assessment reveal |
| Integrated automated five-step regression | **PASS** in Chromium CI; all three Stage 19 workflow/interaction regressions pass |
| Native Windows 11 real-disk picker/save and PWA cold offline restart | **OPEN — HUMAN / DEVICE REQUIRED** |
| Physical Android/iPad touch; Firefox/Safari/Edge; NVDA/VoiceOver; reduced-motion/high-contrast; 8 GB Windows performance | **OPEN — HUMAN / DEVICE REQUIRED** |
| Ghanaian installer/instructor validation of scenarios and formulas; native French wording review | **OPEN — EXPERT REVIEW REQUIRED** |
| Protocol-level parity, manufacturer firmware, professional installation validation | **NOT CLAIMED / NOT IN SCOPE** |
| Public deployment of Stage 19 | **NOT CLAIMED**; production hosting must be independently verified |

**Conclusion:** The five practical SecurityLab workflows were operable under browser test conditions, but Cisco's documented simulation depth and hardware/device configuration capabilities remain materially broader in the **networking domain**. SecurityLab's comparative value is its domain-specific CCTV, alarms, access control and power training, not literal Packet Tracer equivalence. It remains an **educational simulation**, not an engineering sign-off, compliance assessment or certification.

## Final Stage 19 branch CI

GitHub Actions run [43745279887](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43745279887) passed with **156/156 unit tests**, **50/50 Chromium end-to-end tests**, strict TypeScript, production build, and **0 reported npm vulnerabilities**. This is development verification, not a paired Packet Tracer user study, real Windows file picker test or professional training approval.
