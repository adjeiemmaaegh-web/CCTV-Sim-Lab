# SecurityLab visual design system and engineering-workspace UX

**Date:** 18 November 2026 · **Scope:** active `SecurityLab/frontend-react` UI only. This is a review-stage implementation, not release acceptance.

## Source of truth and backwards compatibility

`frontend-react/src/main.tsx` imports exactly one stylesheet: `workstation.css`. The legacy workstation, Stage 18 UI and workspace-upgrade rules are inlined **unchanged and in the same order** at the top of that file, followed by the new design-system overrides. The former `ui2.css` and `workspace-upgrade.css` are not loaded by the app; their originals remain in the repository for provenance. Do not re-import these files. The engine, project JSON schema, device profiles, simulation scoring and file-save APIs are not changed.

## Tokens

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Font | `--font-ui` | Inter / system UI | Labels, panels, controls |
| Mono | `--font-mono` | Cascadia / Consolas | Zoom readout, technical values |
| Type | `--type-xs / sm / md / lg / xl` | 12 / 13 / 14 / 17 / 22 px | Progressive information hierarchy |
| Spacing | `--space-1` to `--space-6` | 4 / 8 / 12 / 16 / 24 / 32 px | 4px rhythm |
| Radii | `--radius-sm / md / lg` | 7 / 11 / 16 px | Buttons, panels, onboarding |
| Canvas | `--canvas` | #10283b | Engineering work area |
| Shell | `--bg` | #081320 | Behind panels |
| Surface | `--surface` | #0e2133 | Cards and dock |
| Text | `--text` / `--muted` | #edf5fd / #b2c7d7 | Primary / secondary copy |
| Accent | `--accent` | #5fe3cc | Selected state and primary actions |
| Semantic | `--good / warn / bad` | #6de5b0 / #ffca73 / #ff9297 | Measured status; always pair with words |
| Focus | `--focus` | #ffe18a | 3px visible keyboard focus ring |
| Control | `--control-height` | 40px | Baseline control sizing |

The icon system remains the project's decorative inline SVG set (`components/icons.tsx`). Icons are paired with text or an accessible name; typical sizes are 16–20px in controls, 22–24px in navigation, and larger only for metrics. Do not use icon color as the sole status signal.

## Interaction states

- **Default:** slate panel surface, legible border, visible text.
- **Hover:** brighter panel fill and border, with no hidden action dependency.
- **Selected/pressed:** accent border/fill; SVG device selection also has a contrasting dashed outer ring and `aria-pressed`.
- **Focus-visible:** 3px gold outline on buttons, links, inputs, selects, summary elements and interactive SVG.
- **Disabled:** reduced opacity and native `disabled` semantics, never a clickable fake action.
- **Running, warning, offline and blocked:** semantic status wording accompanies color; the status chip no longer says “Simulation Ready” for an empty project.
- **Saving:** existing unsaved/writing/saved/blocked message and recovery actions are preserved.
- **Feedback:** nonblocking toast, contextual placement/cable/selection bar, measured console values, progress bars with accessible current/max values.

## Desktop workspace

1. Top bar: project access, scenario, design/test mode, simulation readings, assessment.
2. Navigation rail: module entrypoints without replacing the plan.
3. Resizable library: search, equipment filter, manufacturer reference guard, select-to-place.
4. Canvas: floor/topology views, tools, undo/redo, layer switches, accessible zoom, grid, responsive contrast, explicit placement and cable instructions.
5. Inspector: contextual selected equipment/connection properties and simulation-informed values.
6. Console: realtime status, diagnostics, scenarios, assessment, technical tools.
7. Panel menu and focus mode remain reversible; widths are changed by native range sliders.

Keyboard: **Ctrl/Cmd+S** save; **Ctrl/Cmd+Shift+S** Save As; **Ctrl/Cmd+Z/Y** undo/redo; **arrow keys** move selected item (Shift × 10); **Delete** removes; **Escape** cancels; **+ / -** zoom; **0** fits plan; **Space+drag** pans. Interactive inputs and controls take precedence over canvas shortcuts. The Layers & tools “Navigate elements” select is available for keyboard-only selection.

## Beginner and scenario journey

- Quick-start is nonmodal and preserves a working plan underneath.
- Learners can select the current training challenge, start designing, browse its brief, create a blank project, load a worked example, or open a saved local file.
- The challenge panel explains: read brief → install → diagnose → assess → save.
- Progress measures completed objectives against total, and the provisional score is explicitly *not* a certified grade.
- A dated scored assessment is recorded on explicit user action (including unsuccessful attempts) and can be reviewed in assessment history. Practical pass criteria use the existing critical objectives.
- Saving is distinct from assessment. Project JSON files are local; the guide references Project → Save As / Export Backup.

## Mobile / touch

At widths **900px and below**, panels remain mounted (preserving device/edit state); a fixed bottom navigation jumps among **Plan, Devices, Properties, Simulation**. The plan comes first, device choice returns to it, and zoom controls, Pan mode and explicit “Place at view center” are touch-accessible. No gesture is repurposed as a hidden save. Safe-area padding prevents the fixed nav from covering final footer actions. Existing touch-target minimums apply; coarse pointers use minimum 40–48px targets. Motion is suppressed under `prefers-reduced-motion`; forced-color outlines are retained. At larger widths the desktop grid, adjustable panels and focus mode remain active.

## QA and acceptance gates

Automated regression additions are in `frontend-react/e2e/design-system.spec.ts`, covering single CSS import and tokens, task-based onboarding, the scenario progress indicator, placement and selected-property flows, zoom shortcuts and mobile panel navigation. Existing workflows, file safety, PWA, simulator and accessibility suites remain required.

**Review gates not waived:** CI type-check, unit tests, Vite production build and Playwright; Windows Chrome/Edge and touch-device smoke checks; keyboard-only focus order, screen reader, forced-colors, reduced-motion, contrast, 390/768/900/1024/1440px layouts, all modules and offline PWA restart. No physical device integration or professional-installation compliance is established by this UI work. Do not deploy or merge automatically.
