# SecurityLab — User-requested Stage 2, Stage 3 and Stage 4 development

**Project:** SecurityLab, an offline-first static educational security installation simulator.  
**Owner scope split:** The owner handles Stage 1 (deployment) and Stage 5 (real learner, technician and physical-device usability acceptance). Engineering implements Stages 2–4, and **does not declare a full product release**.

## Stage 2 — Improve installation and wiring

**Implementation**
- Model virtual Ethernet interfaces with deterministic port numbering and collision detection.
- Use compatible free switch ports for new cables, prioritizing modeled PoE outputs for IP cameras and non-PoE uplinks for NVRs and other devices.
- Reject links that lack compatible Ethernet interfaces or spare virtual ports, rather than silently creating invalid capacity.
- Replace unbounded cable-port number inputs with a **Connection setup** panel showing each endpoint, occupied ports, modeled PoE status, VLANs, link data and a contextual next check.
- Respect persisted/legacy projects with automatic ports without rewriting their file content.
- Keep coaxial, alarm, access-control and modeled AC/DC/PV wiring on their existing specialized simulation engines. No real electrical safety assessment or manufacturer interoperability is claimed.

**Verification:** Dedicated pure-function unit tests for PoE priorities, uplink reservation, port collision, saturation and legacy imports; browser tests for installation, port editing, Undo and occupied-interface protection.

## Stage 3 — Refine the interface around actual tasks

**Implementation**
- A compact five-step navigation strip provides immediate routes to **Place, Connect, Configure, Test, Save** without limiting advanced engineering tools.
- Activity indicators reflect actual project data: equipment placed, cables connected, explicit configuration changes recorded in the project audit, diagnostic/assessment events and a verified local save. These are **not completion certificates or professional readiness grades**.
- The learner may run the steps in any order. Clicking a step reveals the relevant workspace even after Focus canvas mode.
- Selected-device actions support starting a connection from a specific endpoint and opening simulated fault diagnostics.
- The strip remains keyboard accessible and horizontally scrollable on smaller screens instead of adding another row of wrapped controls.

**Verification:** Task-bar, focus-mode, direct-device-connection and narrow laptop browser regressions.

## Stage 4 — Strengthen realistic troubleshooting

**Implementation**
- A deterministic diagnostic rule engine turns **current simulated evidence** into prioritized, inspectable findings.
- Diagnoses cover cable continuity, port collisions, simulated PoE/power, IP duplication and subnet/VLAN/DHCP, recorder capacity, target coverage, and supported alarm/access/power subsystems.
- Each finding provides the source, issue, and a concrete **next investigation**. Buttons select the actual virtual device/cable or open the appropriate subsystem console. No one-click automatic repair is claimed.
- Findings recalculate after edits; reconnecting a cable removes the corresponding disconnected-cable finding.
- Raw simulator issues remain accessible behind an expandable log; the diagnostic explanations are not LLM guesses and do not claim measured physical compliance.

**Verification:** Pure tests for disconnected cable repair, IP conflicts, low-PoE faults, bounded repeatability and no project mutation; browser tests for fault injection, selecting the affected link, repair and rechecking, plus filtered fault categories.

## Integrity constraints

- Continue a **static HTTPS/offline-first browser app** with local user-owned JSON projects. No backend, accounts, analytics, telemetry, tracking or new third-party scripts.
- No secrets, purchased plans, GitHub Releases, real firmware claims or code signing.
- Tests and build must pass on the final branch and again on `main` before calling these source increments verified.
- Deployment belongs to Stage 1 and may remain blocked by the Vercel free-tier quota; do not mistake merged code for a live deployment.
- Stage 5 learner testing, physical Windows 11 file pickers, offline installed-PWA restart, real phones/tablets, Firefox/Safari, NVDA/VoiceOver, 8 GB device performance, French review and Ghanaian technician sign-off all remain **OPEN**.

## Release judgment

Even when stages 2–4 source checks pass, SecurityLab remains an **educational training simulator**. Its software regression tests do not validate a real installation, vendor hardware, security protection accuracy, safety compliance or professional training suitability.
