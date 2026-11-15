# Stage 20 — Device installation and wiring engineering increment

**Workstream:** User-directed Stage 2 of the three Engineering UX increments; Stage 3 task-flow and Stage 4 troubleshooting follow separately.

## Delivered behaviors

- Two-step canvas connection continues to work without removing the existing simulation modes.
- The simulator assigns explicit unused virtual Ethernet ports to newly created Ethernet cables rather than relying entirely on implicit ID-based allocation.
- A modeled PoE switch prioritizes PoE-capable outputs for IP cameras and non-PoE uplinks for recorders or other non-camera endpoints.
- An exhausted port inventory or an endpoint with no Ethernet interface fails closed with a useful notice instead of inventing a functioning cable.
- Selected cables show a guided **Connection setup** inspector with endpoint names, port numbers, which ports are occupied, modeled PoE output status, effective VLAN and bandwidth, and the actual simulated physical link status.
- In the inspector, occupied ports cannot be selected. Per-endpoint changes are rejected if they collide with another link or exceed the profile's virtual port range.
- Legacy project documents with automatic (unspecified) port numbers remain readable; they are not silently rewritten on load.
- Coax, alarm, access and electrical media remain on their existing specialized engines, with their existing checks and disclaimers.

## Verification gates

- Unit tests cover PoE-port preference, NVR uplink reservation, explicit port collisions, virtual switch saturation, legacy auto assignment and invalid camera-to-camera Ethernet.
- Browser tests install actual virtual links, check port inspector semantics, reassign one port, undo it and verify occupied ports are unavailable.
- All pre-existing unit, browser and offline tests must pass. The user owns physical QA and professional content review.

**No manufacturer certification:** This is deterministic virtual port reasoning, not live device management, IEEE conformance validation, physical PoE measurement, cabling certification or actual CCTV commissioning.

Stage 3 will introduce an optional task-focused workflow without locking away engineering features. Stage 4 will add explainable rule-based diagnostics derived from the same simulation result. Stage 1 deployment and Stage 5 learner validation are owner responsibilities.
