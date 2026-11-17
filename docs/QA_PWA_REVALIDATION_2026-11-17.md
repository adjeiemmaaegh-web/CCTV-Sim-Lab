# SecurityLab — PWA update peer-consent revalidation QA

**Date:** 17 November 2026 (Asia/Dubai).  
**Baseline:** `main` `6f37f117002baa645929bcf7fefb6252579b8107`.  
**Exact two-test source SHA:** `1660148c817258fb0a01d1a11d89bdf929140096`, [PR #17](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/pull/17).  
**Classification:** B4 automated safety improvement; **NOT** physical Windows 11 or installed-PWA acceptance.

## Gap

The previous source required all available same-origin clients to answer a single service-worker safety poll. It could still activate a new service worker if another editor began changing its project **after its first safe response** and before activation. In addition, a newly opened client was not necessarily among the clients that gave the initial approval.

## Precise behavior introduced

The generated waiting worker in `SecurityLab/frontend-react/scripts-build-pwa.mjs` now:

1. Enumerates currently available scoped window clients and records their sorted client IDs; an empty set fails closed.
2. Requests a positive, read-only `SECURITYLAB_UPDATE_SAFETY_RESULT` from **every** client over independent MessageChannels. Errors, negative replies or 2.5-second timeouts fail closed.
3. Waits **125 ms** (production, not a hard real-time bound) to allow new browser editor state to settle.
4. Enumerates clients again, requires **the exact same client IDs**, and obtains a **second set of positive safety replies**.
5. Enumerates once more to reject clients added or removed during the second pass, before calling `skipWaiting()`.

The existing requesting-tab check still requires a confirmed user-file save and limits the automatic reload to that initiating tab. Other editors are never automatically saved or discarded. The implementation is a **two-phase recheck, not an atomic lease or lock**: project edits can still start after the final positive response, and browser scheduling and tab lifecycle are not atomic. Cross-profile, other-origin, OS file editor and physical network/device consistency are not covered.

## Automated regressions

`e2e/update-origin.ts` serves a changed **test-only** worker script on an isolated localhost origin. For these tests alone it signals completion of the first safety round and expands the 125 ms window to **1,200 ms** to force the otherwise hard-to-reproduce timing. The generated production worker contains **neither this signal nor the 1,200 ms artificial pause**.

`e2e/pwa-update-race.spec.ts` checks two cases:

- **Late edit:** A requests an update while two tabs are clean; immediately after first-pass approval, B edits the Night field. The worker must **refuse activation**, remain waiting and preserve B's in-memory draft. B then saves via an OPFS-backed FileSystemFileHandle test double; the browser independently reads the JSON and verifies Night=true, revision 1 and SHA-256 checksum format. A retries; the worker activates, and B remains open.
- **New client between passes:** A requests while two tabs are clean. After first-pass approval, a **third clean tab** opens. Because that tab never gave first-pass consent, activation must **fail closed** even though no tab is dirty. Retry with three stable tabs succeeds.

Both cases use real Playwright Chromium pages and generated service workers, not simulated text-only security events.

## Exact-code CI verification

| Evidence | Result |
|---|---|
| [Linux CI 43994845809](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43994845809) | **PASS:** 171/171 Vitest; **75/75 Chromium**, including both new race tests |
| [Windows Server 2025 QA 43994845853](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/actions/runs/43994845853) | **PASS:** 171/171 Vitest; **75/75 Chromium**, both race tests; unsigned ZIP integrity check |
| Windows portable package | `securitylab-0.17.0-static.zip`, SHA-256 `c1d10f057b4e5add84258ec6d05e28cc2dbb1be682ca5ae31802e37fe3001663`; 8 manifest entries |

The Firefox/WebKit cross-browser workflow runs the pre-existing 76 engine tests, **not** the new Chromium-specific race tests. All physical device and installer evidence remains uncollected.

## Not covered / required owner action

**B4 remains PARTIAL automated / physical NOT RUN.** Real Windows 11 installed PWA version transition, native operating-system file picker, disk write and cross-tab lifecycle must still be tested using an explicitly approved nonproduction changed-build deployment. The test must include both an unsaved editor and a tab opening or closing during update negotiation. The owner must capture evidence and any failure before signoff. A/B/C/D/E acceptance remains open. This is still an educational simulator, with no real CCTV hardware functionality or professional installer certification inferred from passing tests.

**Overall professional/commercial release: NO-GO.** [Acceptance issue #12](https://github.com/adjeiemmaaegh-web/CCTV-Sim-Lab/issues/12) remains open.
