# Intersect — MASTER

Document revision: 17
Created: 2026-09-26
Updated: 2026-10-03
Project state: Adaptive graphics and linked bilingual credits verified and published; GitHub has 206 commits and https://intersect-juxdeveloper.pages.dev/ is live. Application licensed under GNU GPL v3.0 (GPL-3.0-or-later).
Current phase: User-authorized adaptive graphics, refined credits, six-commit GitHub publication, and branded Cloudflare Pages deployment (COMPLETED). Shutdown remains prohibited.
Next phase: None authorized. No shutdown or additional product work.

## 1. Purpose and use across fresh Codex chats

This is the durable project context for Intersect. Every version will be implemented in a fresh Codex conversation against the same evolving repository. Do not depend on previous chat memory.

At the start of each phase, read this file, applicable repository instructions, the current phase prompt, and the relevant source. Check the actual repository and verification evidence before trusting recorded completion. Explicit current user decisions supersede older project decisions; record any resulting change here. Repository facts establish what exists; this document establishes the intended product. Surface contradictions rather than silently changing requirements.

Implement only the requested version and necessary repairs to its prerequisites. Finish its acceptance gate before advancing. Completing one version is not authorization to start the next. Preserve unrelated user work. Do not deploy or publish unless separately requested.

Update this document in place when the user requests a context change. Every authorized implementation phase also includes a factual handoff update: completed work, decisions, commands and outcomes, limitations, blockers, and next phase. Never mark a phase complete based only on code written or tests not run. Keep this document concise enough to read at each fresh start; link detailed evidence rather than copying logs.

## 2. Product goal

A fully static, open-source educational web application that accepts two free-form real surface equations in x, y, z and produces one simple, verified exact parameterization r(t), a valid parameter interval, an explanation, and an interactive 3D graph.

The UI is polished, minimal, responsive across phones, tablets, and desktops, supporting both Light and Dark themes, with Spanish as the initial default language and full offline PWA capability.

## 3. Confirmed requirements (Updated V12 Follow-Up)

### Input and mathematical output

- Two equation fields, Surface F and Surface G, with MathLive virtual math keyboards and physical keyboard input. Mobile layout features a bottom-docked virtual keyboard with expand/collapse affordances.
- Accept free-form mathematical equations rather than restricting the keyboard to preset surfaces. Unsupported syntax or mathematics must receive a clear explanation. Free-form entry does not promise universal exact solvability.
- Return exactly one active exact parameterization and its valid real parameter domain. Prefer simple verified expressions among the candidates actually found; do not claim a globally simplest answer. Mathematical formulas $r(t)$ and intervals are presented using native MathLive LaTeX typography.
- No numerical approximation substituted for the requested exact formula. Numeric sampling is allowed for rendering and diagnostics, and is never proof of an exact answer.
- Verify both surface equalities over the stated real parameter domain, including denominators, radicals, and other domain restrictions. A formula matching a few sampled points is not sufficient.
- Collapse the derivation initially. Show the transformations actually used by the solver, with brief educational explanations localized into Spanish and English.
- No alternative count, “generate one more” button, alternative list, or alternative swatch collection.
- Redundant boilerplate, helper copy ("Free-form equation • MathLive..."), routine success "Verified" banners, and technical internal diagnostic labels are completely removed. Actionable errors, limits, and proof-based empty explanations are preserved.
- Handle isolated points, overlapping/coincident surfaces, multiple components, unsupported equations, and inconclusive results explicitly. Do not misrepresent a point or a surface as a nonconstant intersection curve.
- Multiple disconnected components must not be silently joined. Returning one verified component must make its scope clear without claiming it is the entire intersection.

### Space, direction, coordinate references, and rendering

- Right-handed Cartesian coordinates with +Z up.
- Calculation/navigation bounds: x, y, z each in [-1000, 1000], a 2000 × 2000 × 2000 block centered at the origin.
- Initial reference view: x, y, z each in [-50, 50], a 100 × 100 × 100 block centered at the origin.
- **Numbered, legible 3D coordinate references**: Thick theme-aware axes (X red `#e05252`, Y green `#38a169`, Z blue `#3182ce`), arrowheads, axis end labels, screen-stable origin marker "0", and dynamic zoom-dependent numeric tick marks (1/2/5 × 10^k steps) formatted for the active locale. Collision-avoiding text sprite caching without per-frame allocations.
- **Smooth translucent surfaces with subtle coordinate guides**: Smooth shading via edge-vertex welding and implicit gradient normals (eliminating faceted checkerboards and triangle wireframes). Sparse, subtle GeoGebra-style coordinate-section guide lines following the surfaces with depth bias to avoid z-fighting.
- Mouse and touch orbit, pan, and zoom within the documented bounds.
- Direction control: Forward / Reverse with concise Lucide icons. Forward means increasing parameter along the displayed formula; reverse shows the corresponding reversed formula and domain.
- Animate the curve being traced, with a refined, bounded-scale direction arrow showing tangent traversal. Provide replay interaction and respect reduced-motion preferences.
- Render both original surfaces in fixed, distinct translucent colors (Surface F `#5b8ec7`, Surface G `#8f94a0` in dark; contrast-balanced in light).
- Custom color picker edits active curve color. Single-click opens popover, double-click edits, with keyboard/touch support.
- Meshes and curve samples approximate the display; the mathematical result is separately represented and verified.

### Result wording and localization

- Default interface language: **Spanish** (`es`) on first visit, with an **English** (`en`) switch. Spanish applies on first visit regardless of browser language. Persist explicit user choice.
- Complete translation coverage: buttons, labels, error diagnostics, derivation steps, scope descriptions, keyboard titles, and aria attributes.
- Proved no intersection in the bounded region: explain the mathematical reason and the scope of the proof.
- An unsuccessful search, timeout, or inability to establish existence: “No se pudo determinar” / “Could not determine” with a brief reason and specified bounds.
- An intersection established but no supported exact parameterization: state that limitation honestly.

### Themes, visual design, and branding

- **Themes**: Auto / Light / Dark, with **Auto** initially following `prefers-color-scheme`. Explicit Light or Dark selection persists in localStorage. Theme switching updates HTML tokens and 3D WebGL scene colors instantly without reload or calculation reset.
- Minimal aesthetic: custom sleek scrollbars, high-contrast typography, restrained neutral surfaces, and Lucide icons.
- **Branding**: Original clean vector SVG logo motif (`Logo.tsx`, `public/logo.svg`, `public/favicon.svg`), full icon suite (192, 512, maskable, apple-touch).
- Desktop reference: left control panel, dominant graph at right. Mobile: bottom-docked virtual keyboard and responsive layout.

## 4. Static architecture, offline PWA, and dependency policy

All computation, rendering, and storage run in the user's browser. Deliver static files only. No application backend, serverless calculation endpoint, hosted AI, remote solver, account system, analytics, runtime package installation, external fonts, CDN dependency, or third-party runtime request.

- **Full Offline Installable PWA**: Background preparation starts automatically on first visit without consent prompt or manual opt-in. Full runtime closure precached via Service Worker (Pyodide WASM, SymPy & Mpmath wheels, Python stdlib zip, MathLive KaTeX fonts, Three.js, workers, JS/CSS bundles, icons). Valid caches reused across visits.
- **Offline Calculation**: Fresh unseen equations solve purely offline via local Pyodide/SymPy worker.
- **Cloudflare Pages Delivery**: Configured for static hosting. Domain-dependent canonical/OG URLs are omitted until exact custom domain is specified. Deployment/publishing is not authorized.

Bundle or copy every required runtime asset into the distributable: JS, worker files, CSS, fonts, WASM, Python runtime/package assets, and licenses as applicable. A lazy-loaded asset must still come from the same static distribution. Production must not fall back to a CDN. Resolve paths for both root and subdirectory hosting.

The user prohibited online searching during this project discussion. For implementation use repository files and locally installed documentation; do not browse for recommendations. Dependency acquisition at development/build time is distinct from runtime operation: use the execution environment's authorized package workflow if available, lock versions, and record a genuine availability blocker rather than fetching around restrictions. No remote build or hosting service is required by the architecture.

| Responsibility | Selected approach | Boundary |
| --- | --- | --- |
| App | TypeScript, React, Vite | Static output; React does not run heavy mathematics |
| Styling | Custom responsive CSS | Reference-driven; no unnecessary component framework |
| Math entry | MathLive | Free-form input; keyboard/rendering assets local |
| Parsing | MathLive Compute Engine | Structured expression parsing; explicit safe bridge to SymPy |
| Symbolic mathematics | SymPy via Pyodide | Dedicated worker; load runtime and packages locally |
| Solving and derivation | Application-owned symbolic strategies | No turnkey universal parameterizer is assumed |
| Geometry | Bounded implicit-surface meshing and curve sampling | Workers, clipping, discontinuity handling, adaptive detail |
| 3D scene | Three.js and OrbitControls | Explicit Z-up configuration; mouse and touch |
| Math display | Existing math stack or a justified local renderer | Avoid redundant engines without a demonstrated need |
| Persistence | IndexedDB | Serializable versioned results, no cloud sync |

Install dependencies when their phase needs them. V1 does not need to bundle Pyodide or build the 3D engine simply to establish their architectural contracts. Record installed versions rather than inventing version numbers. Prefer open-source dependencies with documented redistribution terms. The app's own license choice is pending; do not silently assign a copyright owner or license grant.

## 5. Mathematical honesty and technical boundaries

- Accept broad equations while reporting actual support honestly. Do not market an unmeasured “almost all equations” success rate.
- The first solved example is not a solver. Do not hardcode example answers or tie supported math to a fixed surface picker.
- Symbolic identities, valid domains, and coverage are different facts; preserve which facts have been established.
- Bounds do not turn a numerical scan into proof of absence. No geometry result may silently upgrade a mathematical result's confidence.
- Keep input parsing, symbolic solving, geometry generation, rendering, and persistence behind small explicit boundaries.
- Use structured serializable data across workers. Never evaluate arbitrary user text as JavaScript or Python source.
- Support cancellable jobs, stale-result rejection, resource limits, and worker recovery when the runtime is implemented.
- Handle finite, infinite, open, closed, and disconnected parameter domains explicitly where needed; do not encode infinity as JSON numbers or lose exact endpoints to floating point.
- Keep the architecture small. Do not introduce a plugin framework, generalized service layer, arbitrary feature flags, or enterprise scaffolding without a concrete need.

## 6. Version staircase and gates

All versions are pending until repository evidence shows otherwise.

| Version | Scope | Gate |
| --- | --- | --- |
| V1 | Foundation, repository handoff, shared contracts, static runnable shell | Production build, type checks, meaningful contract tests, basic responsive shell, no external runtime requests |
| V2 | Mathematical input and conversion pipeline | Representative valid/invalid inputs, faithful expression conversion, precise unsupported messages; Python execution integration waits for V3 |
| V3 | Local Pyodide/SymPy worker runtime | Local assets, responsive UI, initialization, cancellation, timeout, stale-job handling, recovery; V2 bridge integration verified |
| V4 | Exact intersection engine | Representative mathematical cases, one verified simple candidate, valid domains, explicit component/degeneracy outcomes |
| V5 | Derivation, forward/reverse, bounded outcome explanations | Recorded transformations and displayed formulas/domains agree; reversal preserves geometry |
| V6 | Surface and curve geometry | Correct sampling/meshing within stated display tolerances; discontinuity and bounds handling |
| V7 | Interactive 3D | Transparent surfaces, one curve, Z-up, navigation and resizing on touch and mouse |
| V8 | Complete calculation UI | MathLive through result and graph workflow; collapsed derivation; responsive reference-based layout |
| V9 | Animation and styling | Trace arrow, replay, reversal, active curve color, touch/keyboard equivalents |
| V10 | Local history | Restore, delete, migration, persistence and failure handling |
| V11 | Performance and accessibility | Measured budgets, resource cleanup, adaptive detail, keyboard/focus/contrast/reduced motion checks |
| V12 | Final verification and release preparation | Regression suite, visual review, static request audit, documentation and licenses; deployment only if requested (COMPLETED) |

Phase completion means: scoped behavior implemented, relevant verification passed, no known phase-blocking defect, and this handoff updated. Required verification that cannot run means blocked or partial, not complete. No automatically generated prompt or phase starts merely because the previous one finished.

## 7. Fresh-chat operating procedure

1. Read MASTER.md, repository instructions, and the requested version prompt.
2. Inspect project state, current changes, dependency lockfile, and prior evidence. Preserve unrelated changes.
3. Confirm the previous version's gate from evidence. Repair prerequisites when needed; report a genuine blocker before dependent work.
4. Implement only the current version. Make routine reversible decisions independently and record meaningful choices.
5. Verify behavior with proportionate meaningful tests, not tests that merely repeat implementation details.
6. Update this file's status, decisions, evidence, limitations, and next step. Preserve the agreed contract and roadmap.
7. Report what changed, checks and actual results, blockers, and exactly which phase is ready next. Stop.

## 8. Current repository handoff — V10 completion state

- Repository path: `/home/joseph/Intersect`
- Current branch / commit: `master`
- Actual installed dependencies:
  - Production: `react@19.0.0`, `react-dom@19.0.0`, `@cortex-js/compute-engine@0.136.2`, `three@^0.186.1`, `mathlive@0.110.0`
  - Bundled local Python runtime (`public/pyodide/`):
    - `pyodide@0.27.8` (`pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`, `pyodide.mjs`)
    - `sympy@1.13.3` wheel (`sympy-1.13.3-py3-none-any.whl`, SHA-256: `f36c07ec76b7260cf8dbf58d0fc659858525b6a7a00fb4c919d3630f9bf5173e`)
    - `mpmath@1.3.0` wheel (`mpmath-1.3.0-py3-none-any.whl`, SHA-256: `5c8b3c27e85c7c427e9929f6da21b44ecdd2ef29f2c342f741ad7755b6ef9436`)
    - Manifest & Licenses: `public/pyodide/manifest.json` (17.55 MB total across 7 files) and `public/pyodide/LICENSES.txt` (MPL-2.0, PSF-2.0, BSD-3-Clause).
  - Bundled local fonts (`public/fonts/`):
    - 20 KaTeX `.woff2` font files for MathLive virtual keyboard; `public/fonts/LICENSES.txt` (MIT for MathLive, SIL OFL-1.1 for KaTeX fonts).
  - Development / Tooling: `typescript@5.7.3`, `vite@6.2.0`, `vitest@3.0.7`, `@types/react@19.0.10`, `@types/react-dom@19.0.4`, `@types/three@^0.186.1`, `@vitejs/plugin-react@4.3.4`, `puppeteer-core@25.12.0` (for local headless Chromium browser verification).
- Reference asset: Preserved at `docs/reference/20308.png` and `reference.png`.
- Source entry points:
  - Local History & Persistence: `src/persistence/{indexeddb-store, memory-store, history-controller, legacy-migration, validation, types, useHistory, index}.ts`
  - 3D Rendering & Animation: `src/rendering/{types, materials, grid-axes, scene-controller, curve-animator, index}.ts`
  - Surface & Curve Geometry: `src/geometry/{evaluator, marching-cubes-tables, marching-cubes, curve-sampler, geometry-generator, geometry.worker, geometry-controller, useGeometry, index}.ts`
  - Symbolic solving & traversal: `src/runtime/{sympy.worker.ts, runtime-controller.ts, useSymPyRuntime.ts, sympy_builder.py, python-source.ts, manifest.json, index.ts}`, `src/math/{reversal,ast,parser,validator,domain,rational,limits,sympy-bridge,pipeline,index}.ts`
  - Shared contracts: `src/contracts/{bounds,expressions,domain,curve,geometry,derivation,results,calculation,appearance,persistence,worker,index}.ts`
  - App shell & components: `src/main.tsx`, `src/App.tsx`, `src/components/{GraphViewport, DirectionToggle, ResultSection, EquationInputSection, StatusBadge, DerivationCard, ColorEditorPopover, HistoryDrawer, MathFieldInput, Header}.tsx`
  - Styles: `src/styles/app.css`, `src/styles/theme.css`
  - Asset pipeline & scripts: `scripts/{prepare-pyodide.mjs, verify-browser.mjs, verify-v5-browser.mjs, verify-v6-browser.mjs, verify-v7-browser.mjs, verify-v8-browser.mjs, verify-v9-browser.mjs, verify-v10-browser.mjs, test-subdir-server.mjs}`
  - Documentation: `MASTER.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`
- Verification commands & real outcomes:
  - `npm run typecheck` (`tsc --noEmit`): PASSED (0 errors, strict mode enabled).
  - `npm run test` (`vitest run`): PASSED (192/192 tests passing across 15 test suites: contracts, math pipeline, reversal, geometry evaluator, marching cubes, curve sampler, geometry worker integration, runtime manifest, runtime controller, SymPy worker integration, v4 solver, v5 derivation, 3D scene controller, curve animator, and persistence suite).
  - `npm run build` (`npm run prepare:runtime && tsc --noEmit && vite build`): PASSED (static bundle emitted to `dist/`, base-path relative with `base: './'`, Pyodide runtime in `dist/pyodide/`, fonts in `dist/fonts/`, worker chunks emitted).
  - Network & asset audit: Verified 0 external runtime requests; no CDNs, external fonts, or remote services.
  - Browser verification (`scripts/verify-v10-browser.mjs` with Puppeteer-core + `/usr/bin/chromium` with SwiftShader WebGL 2.0):
    1. Initial empty state & Esc focus return: Drawer opens with empty state message; Escape key closes and restores focus.
    2. Calculation saved in IndexedDB: $x^2+y^2=9$ cylinder-plane, Emerald Mint `#34d399` color, Reverse traversal saved atomically.
    3. Full page reload & one-click restoration: Restores equations, Reverse direction, exact formula and domain, `#34d399` color, and 3D curve with `workerSolvedAgain: false`.
    4. Proved empty outcome: $z=1, z=5$ parallel planes saved and displayed with `Empty` status badge.
    5. Single row deletion and bulk clear: Individual record deleted; clear all with confirmation modal emptied store.
    6. Mobile portrait ($390 \times 844$): Drawer fits screen cleanly without horizontal overflow (width 343px $\le$ 390px).
    7. Subpath hosting: Verified at `http://localhost:4180/subpath/`.
    8. Static network audit: 34 requests served locally, 0 external/remote requests.
- Completed versions: V1, V2, V3, V4, V5, V6, V7, V8, V9, V10.
- Current version status: V10 complete and verified.
- Next action: Await user request to begin Phase V11 (Performance and accessibility).

## 9. Decision log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-09-26 | Entire app static; computation and data local; no online runtime provider | Confirmed |
| 2026-09-26 | Broad free-form equations; exact output only; honest unsupported/inconclusive results | Confirmed |
| 2026-09-26 | Remove alternative parameterizations UI and generation | Confirmed; supersedes original concept |
| 2026-09-26 | Forward / Reverse with animated direction arrow | Confirmed; supersedes clockwise/counterclockwise |
| 2026-09-26 | Calculation bounds ±1000; initial reference view ±50 | Confirmed |
| 2026-09-26 | Each version implemented in a new Codex chat with MASTER.md as durable handoff | Confirmed |
| 2026-09-26 | English interface; one editable active color; one verified component selection policy deferred to V4 | Implementation defaults / open policy, not extra user promises |
| 2026-09-26 | Use MathLive Compute Engine with `form: 'raw'` and `parseNumbers: 'rational'` to prevent domain-erasing simplifications | Confirmed for V2 |
| 2026-09-26 | Lossless rational conversion for decimal literals via BigInt to avoid IEEE 754 float drift | Confirmed for V2 |
| 2026-09-26 | Strict allowlist: variables {x, y, z}, constants {pi, e}, reserved parameter 't'; fail closed on unknown symbols | Confirmed for V2 |
| 2026-09-26 | Safe typed SymPy construction plan without eval(), string interpolation, or Python code generation | Confirmed for V2/V3 bridge |
| 2026-09-26 | MathLive virtual math keyboard explicitly scheduled for V8; plain LaTeX/math text fields used in V2 shell | Confirmed |
| 2026-09-26 | Vendored Pyodide 0.27.8 and pinned SymPy 1.13.3 + Mpmath 1.3.0 wheels locally in `public/pyodide/` with SHA-256 integrity verification | Confirmed for V3 |
| 2026-09-26 | Override Pyodide internal CDN URL (`_api.setCdnUrl`) to relative `pyodideBaseUrl` so that root and subdirectory hosting work without network fallback | Confirmed for V3 |
| 2026-09-26 | Real-root evaluation semantics in SymPy builder: odd negative roots constructed via `sp.real_root(base, q)**p` to prevent complex branch results (`(-8)^(1/3) == -2`) | Confirmed for V3 |
| 2026-09-26 | Strict allowlist dispatch table in `sympy_builder.py`; zero user text `eval()` / `exec()`; explicit JSON serialization and PyProxy destruction | Confirmed for V3 |
| 2026-09-26 | Main-thread runtime controller with generation IDs, single active computation policy, 300ms grace period on cancel before hard worker termination and re-spawn to preempt busy synchronous loops | Confirmed for V3 |
| 2026-09-27 | Three.js bundled locally (`three@^0.186.1`, `@types/three`) without CDN or external dependencies | Confirmed for V7 |
| 2026-09-27 | Z-up right-handed coordinates: `camera.up.set(0, 0, 1)` set prior to OrbitControls instantiation | Confirmed for V7 |
| 2026-09-27 | Oblique framing vector $(1.15, -1.35, 0.95)$ framing $[-50, 50]^3$ comfortably with $D = (R \times 1.2) / (\tan(\theta/2) \cdot \min(1, \text{aspect}))$ | Confirmed for V7 |
| 2026-09-27 | Bounded navigation: Inspected target clamped to $[-1000, 1000]^3$ calculation box, shifting camera position by $\Delta T$ to preserve camera-target offset without jumps | Confirmed for V7 |
| 2026-09-27 | Non-depth-writing translucency (`transparent: true`, `depthWrite: false`, `side: DoubleSide`) for Surface F (`#5b8ec7`) and Surface G (`#8f94a0`) eliminates triangle sorting artifacts | Confirmed for V7 |
| 2026-09-27 | High-DPI curve width: Three.js `Line2` / `LineMaterial` with 3.5px width and `renderOrder: 10`; multi-segment curves extract distinct draw objects without false bridges | Confirmed for V7 |
| 2026-09-27 | Render-on-demand loop sleeps when controls settle (`camDeltaSq < 1e-5`), 0% idle CPU; pixel ratio capped at 2 | Confirmed for V7 |
| 2026-09-27 | Debounced region navigation updates (450ms) to request progressive geometry without flooding Web Worker queue | Confirmed for V7 |
| 2026-10-02 | Traversal animation duration calibrated to 2600ms spatial arc-length pacing; monotonic rAF clock with tab-hidden accumulation pause | Confirmed for V9 |
| 2026-10-02 | Line2 progressive reveal via `instanceCount = k` on completed segments and smooth dynamic `leadLine` for the moving sub-segment head | Confirmed for V9 |
| 2026-10-02 | Restrained direction arrow cone at trace head with apex oriented along local tangent; dynamic distance scaling; static cue retained at completion | Confirmed for V9 |
| 2026-10-02 | Prefers-reduced-motion: displays full curve immediately with static direction cue; zero auto-play looping | Confirmed for V9 |
| 2026-10-02 | Curve color customization: single-click selection, double-click or explicit edit icon button opens accessible modal popover (`role="dialog"`) with focus trapping & restoration | Confirmed for V9 |
| 2026-10-02 | Curated 8-color high-contrast palette + custom `#RRGGBB` hex field with live preview, Escape/Cancel revert, and Apply / outside-click commit | Confirmed for V9 |
| 2026-10-02 | Deterministic color allocator across distinct calculations with sequential wraparound; serializable `CurveAppearance` exported for V10 persistence | Confirmed for V9 |
| 2026-10-02 | Native IndexedDB database `intersect_db` (version 1) with object store `calculations` and keyPath `id`; indexes on `createdAt` and `statusKind` | Confirmed for V10 |
| 2026-10-02 | Strict record payload versioning (`persistenceSchemaVersion: 1`, `payloadVersion: 1`) with runtime schema validation and quarantine fallback | Confirmed for V10 |
| 2026-10-02 | Atomic FIFO retention limit of 100 records and 512 KiB per-record budget with atomic transaction eviction | Confirmed for V10 |
| 2026-10-02 | Graceful fallback to `MemoryHistoryStore` (`storageKind: 'degraded'`) on `SecurityError`, `QuotaExceededError`, or private browsing denial | Confirmed for V10 |
| 2026-10-02 | One-click restoration: restores inputs, exact outcomes, derivation, direction, and curve color without re-running Pyodide/SymPy solver; regenerates 3D geometries dynamically from restored formula | Confirmed for V10 |
| 2026-10-02 | Multi-tab sync via `BroadcastChannel('intersect_history_sync')` and graceful DB closing on `versionchange` | Confirmed for V10 |

## 10. Open decisions to resolve at the relevant phase

- V4: supported symbolic strategy coverage, deterministic component selection, use of piecewise/special-function exact forms, and limits on completeness claims. Do not block V3 on these.
- V6/V7: practical camera navigation limits and detail budgets that implement the world bounds without excessive memory use.
- V9: simple discoverable mobile color-editing equivalent and animation duration (RESOLVED in V9).
- V10: IndexedDB schema versioning, store layout, error recovery on quota/permission denial, and one-click restore transaction mechanics (RESOLVED in V10).
- V11: measurable device/performance budgets based on the implemented workload.
- V12: app license and release/deployment instructions if requested.

## 11. Phase completion records

### Phase V1 — Foundation and contracts (2026-09-26)
- **Scope Implemented**:
  - Initialized static React 19 + TypeScript + Vite project with strict TypeScript checks.
  - Implemented shared domain contracts: spatial bounds, equation source vs structured AST expression, parameter domains with signed infinities safe for JSON round-trips, exact curve and algebraic verification records, discriminated union calculation results, derivation steps, worker request/response envelopes with stale ID protection, and versioned persistence schemas.
  - Built minimal, honest, responsive dark foundation shell following `20308.png`: Intersect title, Surface F and Surface G fields, Forward/Reverse direction controls, Calculate button with contract validation feedback, collapsible derivation, 3D viewport canvas placeholder with right-handed +Z up coordinate axes diagram, and legend bar.
  - Created root `AGENTS.md`, `README.md`, `docs/architecture.md`, and preserved visual reference at `docs/reference/20308.png`.
- **Commands & Outcomes**:
  - `npm install`: Added 103 packages, committed lockfile (`package-lock.json`).
  - `npm run typecheck`: Passed with 0 errors (`tsc --noEmit`).
  - `npm run test`: 15 passed in Vitest (`vitest run`).
  - `npm run build`: Static production bundle successfully built to `dist/` with relative asset links (`base: './'`).
  - Asset audit: 0 external runtime requests, no CDNs or external fonts.
- **Next Phase**: V2 — Mathematical input and conversion pipeline.

### Phase V2 — Mathematical input and conversion pipeline (2026-09-26)
- **Scope Implemented**:
  - Installed and verified `@cortex-js/compute-engine@0.136.2` for LaTeX/math parsing without remote dependencies.
  - Implemented conservative pre-parse checks and AST limits (`MAX_INPUT_LENGTH = 500`, `MAX_TREE_DEPTH = 30`, `MAX_NODE_COUNT = 250`).
  - Built lossless MathJSON-to-AST adapter using `form: 'raw'` and `parseNumbers: 'rational'` to preserve non-simplified algebraic structure and exact decimal rationals without IEEE 754 drift.
  - Implemented arbitrary-precision decimal-to-rational converter using string-backed `BigInt` GCD arithmetic.
  - Built semantic equation validator: enforces single equality relation (`lhs = rhs` or standalone `expr = 0`), rejects chained equalities (`x = y = z`) and inequalities (`<, <=, >, >=`), allowlists real variables `x, y, z` and exact constants `pi, e`, reserves parameter `t` with guidance, and classifies equations (`standard`, `constant-identity` for `0 = 0`, `constant-contradiction` for `1 = 0`).
  - Implemented real-domain symbolic obligation collector: extracts non-zero denominators (`den != 0`), non-negative radicands (`rad >= 0`), strictly positive logarithm arguments (`arg > 0`), and trig/inverse trig domain restrictions, preserving them across algebraic identities (e.g. `x/x = 1` retains `x != 0`, `(x^2 - 1)/(x - 1) = y` retains `x - 1 != 0`).
  - Implemented safe, typed allowlisted SymPy construction plan generator (`SymPyConstructionPlan` and `SymPyConstructionStep`): strictly avoids `eval()`, `new Function()`, string interpolation, or code generation; produces declarative builder trees for Phase V3 Pyodide worker.
  - Connected preparation pipeline to application boundary (`prepareCalculationRequest`), highlighting field diagnostics in `EquationInputSection` and reporting truthful V2 validation status without fabricating solved curves or results.
  - Updated `docs/architecture.md` with V2 pipeline diagrams, guarantees, and V3 integration contracts.
- **Important Files**:
  - Implementation: `src/math/{limits,rational,ast,parser,validator,domain,sympy-bridge,pipeline,index}.ts`
  - Shared contracts: `src/contracts/expressions.ts`, `src/contracts/results.ts`, `src/contracts/calculation.ts`, `src/contracts/index.ts`
  - UI integration: `src/App.tsx`, `src/components/EquationInputSection.tsx`
  - Tests: `src/math/__tests__/v2-pipeline.test.ts`, `src/contracts/__tests__/contracts.test.ts`
  - Documentation: `MASTER.md`, `docs/architecture.md`
- **Commands & Outcomes**:
  - `npm install @cortex-js/compute-engine`: Added package cleanly to `package.json` and `package-lock.json`.
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npm run test`: PASSED (51/51 tests passing in 1.69s; 15 contract tests + 36 V2 pipeline tests covering all 11 required categories: basic equations, free composition, input conventions, notation & precedence, exactness, domain obligations, invalid inputs, degenerate inputs, safe boundary injection resistance, complexity limits, and application integration).
  - `npm run build`: PASSED (static production bundle in `dist/`, base-path relative with `base: './'`).
  - Network & asset audit: Verified 0 external runtime requests, no CDNs, no external fonts.
  - Preview server: Static preview verified running on port 4173 via curl.
- **Limitations / Deferred Work**:
  - Automated browser context creation failed due to execution environment Playwright driver download 404 (`azureedge.net`); local preview server verified running and serving static bundle via curl.
  - Symbolic execution inside SymPy runtime is deferred to Phase V3 (worker execution engine).
  - Solving exact curve parameterizations is deferred to Phase V4.
  - MathLive virtual math keyboard UI is deferred to Phase V8.
- **Next Phase**: V3 — Local Pyodide/SymPy worker runtime.

### Phase V3 — Local Pyodide/SymPy worker runtime (2026-09-26)
- **Scope Implemented**:
  - **Local Runtime Asset Pipeline**:
    - Created `scripts/prepare-pyodide.mjs` to vendor Pyodide 0.27.8 (`pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`, `pyodide.mjs`) and download pinned pure-Python wheels (`sympy-1.13.3-py3-none-any.whl`, `mpmath-1.3.0-py3-none-any.whl`) with exact SHA-256 checksum verification into `public/pyodide/`.
    - Generated `public/pyodide/manifest.json` (mirrored in `src/runtime/manifest.json`) verifying 17.55 MB total distribution size and SHA-256 hashes across all 7 runtime assets.
    - Generated `public/pyodide/LICENSES.txt` providing attribution and full text for MPL-2.0, PSF-2.0, and BSD-3-Clause licenses.
    - Wired `prepare:runtime` into `package.json` and build lifecycle.
  - **Safe Python Builder Module**:
    - Implemented `src/runtime/sympy_builder.py` and embedded in `src/runtime/python-source.ts`.
    - Allowlisted builder dispatches operations (`Integer`, `Rational`, `Symbol`, `Constant`, `Add`, `Mul`, `Pow`, `Sqrt`, `Root`, `Abs`, trig, inverse trig, hyperbolic, `exp`, `log`, `Eq`) purely from AST IDs.
    - Guaranteed real-valued mathematical semantics: odd fractional powers of negative bases (e.g. `(-8)^(1/3)`) use `sp.real_root(base, q)**p` to evaluate to `-2` instead of SymPy's default complex principal branch (`1 + sqrt(3)*I`).
    - Domain condition preservation: collected conditions (denominators $\neq 0$, radicands $\ge 0$, logs $> 0$) are maintained separately from simplified residual equations ($x/x = 1$ simplifies to $0$ while preserving $x \neq 0$).
    - Zero user text `eval()` / `exec()`: completely immune to code injection.
    - Explicit memory management: destroys PyProxy objects and returns plain JSON serializable summary.
  - **Worker Contracts & Entry Point**:
    - Extended `src/contracts/worker.ts` with `workerGeneration`, `InitWorkerRequest`, `PreparedExpressionsResponse`, `TestBusyWorkerRequest`, and `isFreshWorkerMessage`.
    - Implemented dedicated Web Worker `src/runtime/sympy.worker.ts` configured for ES modules in Vite (`worker: { format: 'es' }`).
    - Overrode internal CDN URL (`_api.setCdnUrl`) to relative `pyodideBaseUrl` to ensure offline execution in root and subpath deployments.
  - **Runtime Controller & React Hook**:
    - Implemented `src/runtime/runtime-controller.ts` with distinct states: `idle`, `initializing`, `ready`, `busy`, `failed`, `disposed`.
    - Implemented single active computation policy: incoming jobs supersede or queue over prior jobs.
    - Implemented two-tier cancellation: soft cancellation message followed by a 300ms grace timer that forces `worker.terminate()` and spawns a fresh worker generation if the worker is blocked in synchronous code.
    - Configured independent initialization timeout (60s) and execution timeout (30s).
    - Created React hook `src/runtime/useSymPyRuntime.ts` providing reactive worker state, progress, and execution methods.
  - **UI Shell Integration & Styling**:
    - Connected `useSymPyRuntime` to `src/App.tsx`.
    - Dynamic Calculate button shows informative state ("Loading Pyodide...", "Loading SymPy...", "Constructing...").
    - Action buttons: Cancel button appears during initialization/construction; Retry button appears on failure.
    - Preserved responsive dark shell and mathematical honesty: displays truthful V3 runtime status and expression summary without claiming a solved curve.
- **Important Files**:
  - Runtime implementation: `src/runtime/{sympy.worker.ts, runtime-controller.ts, useSymPyRuntime.ts, sympy_builder.py, python-source.ts, manifest.json, index.ts}`
  - Contracts: `src/contracts/worker.ts`
  - Scripts: `scripts/{prepare-pyodide.mjs, verify-browser.mjs, test-subdir-server.mjs}`
  - Tests: `src/runtime/__tests__/{manifest.test.ts, runtime-controller.test.ts, sympy-integration.test.ts}`
  - UI & styles: `src/App.tsx`, `src/styles/app.css`, `index.html`, `vite.config.ts`
- **Commands & Outcomes**:
  - `npm run prepare:runtime`: Verified all 7 runtime assets; SHA-256 hashes matched; licenses and manifest generated.
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npm run test`: PASSED (71/71 tests passing in Vitest across 5 test suites).
  - `npm run build`: PASSED (emitted clean production bundle in `dist/` with relative asset links and `dist/pyodide/`).
  - Browser verification (Puppeteer-core + `/usr/bin/chromium`):
    - Cold start: 11.79s to load Pyodide, stdlib, mpmath, sympy and prepare expressions.
    - Warm calculation: 107ms.
    - Domain condition preservation: Verified `x/x = 1` retains `x != 0`.
    - Cancellation: Verified graceful UI cancellation.
    - Subdirectory hosting: Verified at `http://localhost:4180/subpath/`.
    - Network audit: 10/10 requests from local test origin, 0 external/CDN/telemetry requests.
    - Screenshot: Captured at `browser_v3_success.png`.
- **Limitations / Deferred Work**:
  - Exact intersection curve solving (parameterization, candidate search, algebraic verification) is deferred to Phase V4.
  - Derivation rendering and forward/reverse reparameterization are deferred to Phase V5.
  - Surface meshing and 3D curve geometry are deferred to Phase V6/V7.
  - MathLive virtual math keyboard is deferred to Phase V8.
- **Next Phase**: V4 — Exact intersection engine (COMPLETED).

### Phase V4 — Exact intersection engine (2026-09-26)
- **Scope Implemented**:
  - **Symbolic Intersection Engine (`src/runtime/sympy_builder.py` & `src/runtime/python-source.ts`)**:
    - Preprocessing & trivial emptiness/degeneracy checks: detects constant contradictions ($1=0 \implies$ empty), constant identities ($0=0 \implies$ 2D surface overlap), sums of squares strictly positive ($x^2+y^2+z^2+1=0 \implies$ empty bounded), and point quadrics ($x^2+y^2+z^2=0 \implies$ isolated point origin).
    - Strategy 1: Affine linear plane systems using rank-aware linear algebra and exact cross product ($n_1 \times n_2$). Deterministic canonical direction scaling (first non-zero direction component made positive), particular point selection closest to origin, coordinate bounds box-clipping ($[-1000, 1000]^3$), and real-domain obligation checks.
    - Strategy 2: Plane-sphere system using exact completing the square to find center and radius, orthogonal distance from center to plane ($d$), distance check ($d > R \implies$ empty; $d = R \implies$ isolated tangency point; $d < R \implies$ exact circle cross-section parameterized with orthonormal affine basis vectors $u, v$).
    - Strategy 3: Cylinder-plane system for axis-aligned circular and elliptic cylinders intersected by oblique planes.
    - Strategy 4: Quadric-quadric reduction (e.g. sphere-sphere intersection): eliminates proportional quadratic homogeneous terms to reduce the system to a radical cutting plane and single sphere, then solves the resulting plane-sphere cross section.
    - Strategy 5: Coordinate parameterization ($x=t, y=t, z=t$): substitutes parameter into explicit or single-variable equations, extracts real branches, verifies domain obligations, extracts real poles/singularities, clips parameter intervals to the $[-1000, 1000]^3$ world bounding box, and splits domains at excluded points.
    - Deterministic ranking: evaluates valid parameterizations by simplicity score (penalizing non-rational roots, nested functions, and interval count) to reliably return the simplest canonical curve.
    - Independent certificate verifier (`verify_candidate`): substitutes $r(t)$ back into original prepared surface equations $F(x,y,z)=0$ and $G(x,y,z)=0$, verifies both identities simplify identically to zero, verifies world coordinate bounds compliance, and produces an algebraic `VerificationRecord`.
    - Pure JSON entry points: `solve_intersection_core` and `solve_intersection_json` returning discriminated union `CalculationResult` schemas.
  - **Web Worker & Runtime Controller Integration (`src/runtime/sympy.worker.ts`, `src/runtime/runtime-controller.ts`, `src/runtime/useSymPyRuntime.ts`)**:
    - Dedicated Web Worker handles `'start-calculation'` messages, cancels ongoing calculations if requested, and returns `{ type: 'result', jobId, result }`.
    - `SymPyRuntimeController` implements `calculateIntersection(request, options)` with single-active-computation enforcement, timeout preemption, and graceful cancellation.
    - `useSymPyRuntime` exposes `calculateIntersection` to React.
  - **UI Shell Integration (`src/App.tsx`, `src/components/ResultSection.tsx`, `src/components/DirectionToggle.tsx`)**:
    - Calculate button triggers full exact symbolic calculation in Pyodide/SymPy Web Worker.
    - `ResultSection` renders all discriminated union outcomes honestly:
      - `verified-curve`: displays exact $r(t) = (x(t), y(t), z(t))$, exact formatted parameter domain, algebraic verification badge, component scope, and expandable derivation steps.
      - `empty-bounded`: displays empty intersection card with explicit proof explanation and reason code.
      - `degenerate`: displays degenerate nature, explanation, and coordinates of isolated points.
      - `inconclusive` / `unsupported`: displays honest classification without fabricating curves.
    - `DirectionToggle`: honestly preserves Forward canonical traversal and marks Reverse as disabled with informative notice that reverse reparameterization is scheduled for Phase V5.
- **Important Files**:
  - Engine: `src/runtime/sympy_builder.py`, `src/runtime/python-source.ts`
  - Worker & Controller: `src/runtime/sympy.worker.ts`, `src/runtime/runtime-controller.ts`, `src/runtime/useSymPyRuntime.ts`
  - UI Components: `src/App.tsx`, `src/components/ResultSection.tsx`, `src/components/DirectionToggle.tsx`
  - Tests: `src/runtime/__tests__/v4-solver.test.ts`, `src/runtime/__tests__/runtime-controller.test.ts`
  - Verification script: `scripts/verify-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npm test`: PASSED (96/96 tests passing across all 6 test suites in Vitest).
  - `npm run build`: PASSED (production bundle emitted cleanly in `dist/`).
  - Browser verification (real Chromium Puppeteer against local preview server):
    - Cold start: 12.09s to load runtime and solve $x^2+y^2=4$ and $z=x+y \implies$ verified curve $r(t) = (2\sin(t), 2\cos(t), 2\sin(t)+2\cos(t))$ on $0 \le t < 2\pi$.
    - Warm reuse: 80ms to recalculate.
    - Empty intersection: $x^2+y^2+z^2=1$ and $z=5 \implies$ Empty intersection proved (distance exceeds radius).
    - Degenerate intersection: $x^2+y^2+z^2=4$ and $z=2 \implies$ Degenerate isolated point at $(0, 0, 2)$.
    - Network audit: 10/10 requests served locally from `http://localhost:4173`, 0 external/remote requests.
    - Screenshots captured: `browser_v4_verified_curve.png`, `browser_v4_empty_intersection.png`, `browser_v4_degenerate.png`.
- **Limitations / Deferred Work**:
  - Derivation rendering and LaTeX math step formatting are deferred to Phase V5.
  - Forward / reverse parameterization transformation ($t \mapsto -t$ with inverted endpoints) is deferred to Phase V5.
  - 3D implicit surface meshing and curve rendering are deferred to Phase V6/V7.
  - MathLive virtual math keyboard is deferred to Phase V8.
- **Next Phase**: V5 — Educational derivation and step explanations (COMPLETED).

### Phase V5 — Intersect derivations, traversal, and mathematical explanations (2026-09-26)
- **Scope Implemented**:
  - **Shared Contracts (`src/contracts/curve.ts`, `src/contracts/results.ts`)**:
    - Defined `CurveTraversalMetadata` contract capturing `orientation` ('forward' | 'reverse'), `parameterMapping` (`{ type: 'identity' | 'finite_reflection' | 'uniform_negation', formula: string, canonicalParam: 't', orientedParam: 't' | 'u' }`), `isClosed`, `isPeriodic`, `period`, `segmentCount`, `disjointGapsPreserved`, and `infiniteDomainNote`.
    - Extended `VerifiedCurveResult` to carry both `canonicalCurve`/`reverseCurve` and `canonicalDerivation`/`reverseDerivation` concurrently so presentation can toggle direction in 0ms without re-solve overhead or race conditions.
    - Added `proofScope?: 'global' | 'bounded'` to `EmptyBoundedResult` to distinguish global proofs (parallel inconsistent planes, sphere distance $d > R$) from local bounding box exclusions ($[-1000, 1000]^3$).
  - **Mathematical Traversal & Reversal Engine (`src/math/reversal.ts`, `src/runtime/sympy_builder.py`, `src/runtime/python-source.ts`)**:
    - Periodic closed curves (circles/ellipses on $[0, 2\pi)$): finite reflection $t = 2\pi - u \implies u \in (0, 2\pi]$ reverses traversal while preserving exact trigonometric geometry and algebraic surface membership.
    - Single finite intervals $[a, b]$: finite reflection $t = a + b - u$ (or uniform negation $t = -u$ when $a+b=0$) with endpoint inclusion swapped: $[a, b) \to (a, b]$.
    - Multiple disjoint intervals and infinite intervals: uniform negation $t = -u$ inverts bounds $[-b, -a]$ and reverses segment ordering so increasing $u$ traverses segments in reverse order without crossing gaps.
    - Renames temporary parameter $u$ back to canonical parameter $t$ without symbol capture in displayed formula per Section 5.A.
    - Algebraic verification: explicitly verifies $F(r_{\text{rev}}) = 0$ and $G(r_{\text{rev}}) = 0$ identically on the transformed domain.
    - Traversal metadata generator attaches complete metadata for Phase V6 geometry and Phase V9 animation.
  - **Faithful Educational Derivations (Section 4.A & 6)**:
    - 6 logical steps emitted for each canonical solve: (1) state surface equations and domain restrictions, (2) explain reduction used, (3) introduce parameter and coordinate expressions, (4) establish parameter domain and bounding box check, (5) verify algebraic surface identities identically on domain, (6) state established component scope.
    - Step 7 ("Reparameterize for reverse traversal") appended when reverse is active, detailing exact substitution formula, transformed domain, and preservation of geometry.
    - Explanations for all actual outcomes: global emptiness proofs, bounded region emptiness, isolated tangent points with exact coordinates, coincident planes, and inconclusive/unsupported outcomes without false emptiness claims.
  - **UI Shell & Presentation Layer (`src/components/DirectionToggle.tsx`, `src/components/ResultSection.tsx`, `src/App.tsx`, `src/styles/app.css`)**:
    - `DirectionToggle`: fully enabled Reverse button with `aria-pressed`, accessible titles, and subtext explaining canonical vs reversed parameter traversal.
    - `ResultSection`:
      - Accessible disclosure control (`#derivation-disclosure-toggle`, `aria-expanded`, `aria-controls`, `aria-label`).
      - Keyboard navigation: Enter and Space expand/collapse derivation with `preventDefault()` to prevent scrolling.
      - Auto-collapses on each new calculation (via `calculationId` tracking), strictly preserved across Direction toggle on the same result.
      - Local equation overflow container with `overflow-x: auto` and safe wrapping so long equations scroll horizontally without breaking layout or overflowing the sidebar.
      - Direction badge (`Forward Traversal` / `Reverse Traversal`), traversal metadata note, and component scope note.
      - Derivation steps rendered with formula code blocks, explanations, validity conditions, and Step 7 `Reversal Reparameterization` badge.
      - Empty cards rendered with `Global Emptiness` vs `Bounded Emptiness` badges and reason codes.
      - Degenerate cards display isolated point coordinates cleanly.
    - `App.tsx`:
      - Immediate zero-latency direction swapping between canonical and reverse records in memory without re-fetch.
      - Reference example equipped with forward/reverse curves and derivations.
- **Important Files**:
  - Contracts: `src/contracts/curve.ts`, `src/contracts/results.ts`
  - Reversal math: `src/math/reversal.ts`, `src/math/index.ts`, `src/math/__tests__/reversal.test.ts`
  - Symbolic engine: `src/runtime/sympy_builder.py`, `src/runtime/python-source.ts`
  - Components & Styles: `src/components/DirectionToggle.tsx`, `src/components/ResultSection.tsx`, `src/App.tsx`, `src/styles/app.css`
  - Test suites: `src/runtime/__tests__/v5-derivation-reversal.test.ts`
  - Browser verification: `scripts/verify-v5-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npx vitest run`: PASSED (121/121 tests passing across all 8 test suites in Vitest).
  - `npm run build`: PASSED (production bundle emitted cleanly in `dist/`).
  - `node scripts/verify-v5-browser.mjs`: PASSED (real Chromium Puppeteer against local preview server):
    - Initial derivation collapsed: Verified.
    - Keyboard disclosure (Enter/Space): Verified.
    - Reversal toggle on reference curve: Verified immediate formula update, domain update to $0 < u \le 2\pi$, direction badge update, derivation expansion preserved, Step 7 displayed with badge.
    - Live solver execution on cylinder-plane: Verified derivation auto-collapses on new calculation; algebraic verification badge displayed.
    - Direction toggle on live solver result: Verified instant swap to reversed formula and domain $(0, 2\pi]$ with Step 7.
    - Empty intersection: Parallel planes verified with Global Emptiness badge.
    - Degenerate intersection: Sphere tangent plane verified with isolated point $(0, 0, 2)$.
    - Network audit: 10/10 requests served locally from `http://localhost:4173/`, 0 external/remote requests.
    - Screenshots captured: `v5_browser_reference_reverse.png`, `v5_browser_solver_reverse.png`, `v5_browser_empty_global.png`, `v5_browser_degenerate_point.png`.
- **Limitations / Deferred Work**:
  - 3D implicit surface meshing and curve rendering are deferred to Phase V6/V7.
  - MathLive virtual math keyboard is deferred to Phase V8.
  - Traversal animation (moving arrow along parameter) is deferred to Phase V9.
  - History persistence in IndexedDB is deferred to Phase V10.
- **Next Phase**: V6 — Surface and curve geometry (COMPLETED).

### Phase V6 — Intersect surface and curve geometry (2026-09-26)
- **Scope Implemented**:
  - **Shared Geometry Contracts (`src/contracts/geometry.ts`, `src/contracts/index.ts`)**:
    - Defined versioned request/response contract: `GeometryRequest`, `GeometryResult`, `MeshGeometryBuffer`, `CurveGeometryBuffer`, `GeometryBudget`, and worker message envelopes (`GeometryWorkerRequest`, `GeometryWorkerResponse`).
    - Stale result protection: captures `calculationId`, `jobId`, and `workerGeneration`.
    - Typed buffer specifications:
      - Mesh: `positions: Float32Array` (3 floats/vertex), `normals: Float32Array` (3 floats/vertex, unit vectors), `indices: Uint32Array` (3 indices/triangle).
      - Curve: `positions: Float32Array` (3 floats/sample), `tValues: Float64Array` (double precision parameter values), `segmentBreaks: Uint32Array` (indices of disjoint segment boundaries).
    - Status classifications: `success`, `no-geometry-detected`, `partial-budget-limited`, `unsupported-expression`, `failed`.
    - Quality presets: `draft`, `default`, `high`, `ultra` with calibrated grid resolution, vertex/triangle limits, curve depth limits, and geometric tolerances.
  - **Allowlisted Numerical AST Evaluator (`src/geometry/evaluator.ts`)**:
    - Direct tree and compiled closure evaluator evaluating AST expressions without `eval()` or `new Function()`.
    - Mathematical fidelity: preserves real odd negative roots (e.g. $(-8)^{1/3} = -2$), integer powers, real trig and inverse trig functions, exponential, and logarithm.
    - Preserves domain obligations and pole detection: enforces non-zero denominators, non-negative radicands, and positive logarithm arguments.
    - Tangential zeros & repeated factor reduction: safe symbolic reduction of even powers (e.g. $x^2 = 0 \to x = 0$) allowing root extraction where sign changes do not occur.
  - **Marching Cubes Implicit Surface Extractor (`src/geometry/marching-cubes-tables.ts`, `src/geometry/marching-cubes.ts`)**:
    - Full 256-case Lorensen-Cline table with edge masks and triangle indices.
    - Memory-bounded streaming evaluation: evaluates grid slice-by-slice along Z (keeping working RAM $< 100$ KB regardless of grid dimension).
    - Exact zero handling: deterministic edge root interpolation without cell-boundary dropouts.
    - Mid-edge pole rejection: evaluates midpoint on cut edges to detect asymptotic jumps (e.g. $1/x = 0$), preventing false sheets across poles.
    - Central difference normals with unit normalization and geometric face normal fallbacks.
    - Bounded resource allocation with graceful `partial-budget-limited` return upon budget exhaustion.
  - **Adaptive Exact Curve Sampler (`src/geometry/curve-sampler.ts`)**:
    - Multi-point chord deviation testing evaluating midpoint $t_{\text{mid}}$, $t_{1/3}$, and $t_{2/3}$ to eliminate false straight-line acceptance on high-frequency oscillatory curves.
    - 3D Liang-Barsky box clipping against finite render region with exact parameter refinement.
    - Disconnected interval and singularity handling: preserves gaps and excluded points with explicit `segmentBreaks` without bridging across undefined regions.
    - Finite numerical window policy ($[-100, 100]$) for unbounded parameter domains.
    - Traversal orientation preservation: strictly respects V5 forward vs reverse orientation and parameter mapping.
  - **Dedicated Geometry Worker & Controller (`src/geometry/geometry.worker.ts`, `src/geometry/geometry-controller.ts`, `src/geometry/useGeometry.ts`)**:
    - Dedicated Web Worker configured for ES modules transferring typed `ArrayBuffer`s via transferable objects (zero-copy buffer transfer).
    - `GeometryController` with generation counter, stale result rejection, single active computation preemption, and synchronous in-process fallback for headless Node/Vitest environments.
    - `useGeometry` React hook exposing reactive state, result buffers, diagnostics, and cancellation.
  - **UI Shell Integration (`src/App.tsx`, `src/components/GraphViewport.tsx`, `src/styles/app.css`)**:
    - Connected `useGeometry` to automatically mesh surfaces F & G and sample the verified exact curve upon calculation or reference load.
    - `GraphViewport` displays real-time geometry diagnostics: vertex and triangle counts for Surface F and G, point count and segments for Curve, total buffer bytes transferred, and execution time.
- **Important Files**:
  - Contracts: `src/contracts/geometry.ts`, `src/contracts/index.ts`
  - Evaluator: `src/geometry/evaluator.ts`, `src/geometry/__tests__/evaluator.test.ts`
  - Marching Cubes: `src/geometry/marching-cubes-tables.ts`, `src/geometry/marching-cubes.ts`, `src/geometry/__tests__/marching-cubes.test.ts`
  - Curve Sampler: `src/geometry/curve-sampler.ts`, `src/geometry/__tests__/curve-sampler.test.ts`
  - Worker & Controller: `src/geometry/geometry-generator.ts`, `src/geometry/geometry.worker.ts`, `src/geometry/geometry-controller.ts`, `src/geometry/useGeometry.ts`, `src/geometry/__tests__/geometry-worker-integration.test.ts`
  - UI & Verification: `src/App.tsx`, `src/components/GraphViewport.tsx`, `src/styles/app.css`, `scripts/verify-v6-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npx vitest run`: PASSED (154/154 tests passing across all 12 test suites in Vitest).
  - `npm run build`: PASSED (production bundle emitted cleanly in `dist/` with dedicated worker `geometry.worker-CQe4mIvH.js`).
  - `node scripts/verify-v6-browser.mjs`: PASSED (real Chromium Puppeteer against local preview server):
    - Surface F (cylinder $x^2+y^2=4$): 3,072 vertices, 1,280 triangles.
    - Surface G (plane $z=x+y$): 36,858 vertices, 18,430 triangles.
    - Exact Curve ($r(t)$ ellipse): 33 points, 1 segment, traversal forward / reverse verified.
    - Buffer transfer: 1,167.5 KB transferred in 776 ms.
    - Reversal toggle: Instant update preserving geometry and updating traversal order.
    - Network audit: 4/4 requests served locally from `http://localhost:4174/`, 0 external/remote requests.
    - Screenshot captured: `v6_geometry_verified.png`.
- **Limitations / Deferred Work**:
  - Interactive Three.js scene, camera controls, materials, and lighting are deferred to Phase V7.
  - MathLive virtual math keyboard is deferred to Phase V8.
  - Traversal animation and direction arrows are deferred to Phase V9.
  - History persistence in IndexedDB is deferred to Phase V10.
- **Next Phase**: V7 — Interactive 3D scene and renderer (COMPLETED).

### Phase V7 — Interactive 3D visualization and renderer (2026-09-27)
- **Scope Implemented**:
  - **Local Three.js Runtime & Coordinate System (`src/rendering/index.ts`, `src/rendering/types.ts`)**:
    - Installed `three@^0.186.1` and `@types/three` as local project dependencies with zero remote or CDN dependencies.
    - Right-handed Cartesian coordinates with explicit +Z up: configured `camera.up.set(0, 0, 1)` prior to OrbitControls instantiation.
  - **Visual Hierarchy & Color Palette (`src/rendering/materials.ts`, `src/rendering/grid-axes.ts`)**:
    - Faithfully matched `docs/reference/20308.png`:
      - Near-black canvas background (`#08090d`).
      - Ground XY reference grid at $z=0$ (100-unit span, 20 subdivisions, muted charcoal `#1b1f2b` / `#131620`).
      - Coordinate axes: +X, +Y, +Z with directional cones and high-DPI text sprites (`#d9534f`, `#5cb85c`, `#4a90e2`) with SSR/headless fallback.
      - Surface F material: translucent muted blue (`#5b8ec7`, opacity 0.52, roughness 0.35, metalness 0.05, `depthWrite: false`, `side: THREE.DoubleSide`).
      - Surface G material: translucent neutral gray (`#8f94a0`, opacity 0.48, roughness 0.40, metalness 0.05, `depthWrite: false`, `side: THREE.DoubleSide`).
      - Non-depth-writing translucent materials eliminate triangular z-sorting and clipping artifacts while intersecting.
      - Active intersection curve: high-DPI Three.js `Line2` / `LineMaterial` with 3.5px width and warm off-white color (`#f5eedb`), `renderOrder: 10`, rendering multiple segments as independent line objects without bridging gaps.
  - **Bounded Camera Navigation & Controls (`src/rendering/scene-controller.ts`)**:
    - Calculation bounds: $[-1000, 1000]^3$ world bounding box.
    - Initial reference framing: $[-50, 50]^3$ reference box framed obliquely from $(1.15, -1.35, 0.95)$ unit vector with distance $D = (R \times 1.2) / (\tan(\theta/2) \cdot \min(1, \text{aspect}))$.
    - Target clamping: OrbitControls target clamped strictly to $[-1000, 1000]^3$; camera position shifted by $\Delta T$ to preserve camera-to-target offset without jarring jumps.
    - Discoverable controls: Reset View button restores origin-centered oblique framing; gesture hints for desktop (Left click: Orbit, Right click / Shift: Pan, Scroll: Zoom) and mobile touch (Drag: Orbit, Pinch: Zoom, Two-finger drag: Pan).
    - Dynamic lighting rig: camera-tracking directional key and fill lights plus subtle ambient light.
    - Render-on-demand loop: animates during user interaction or damping settling; sleeps automatically when movement $\Delta^2 < 1\times 10^{-5}$ (0% idle CPU).
    - Device pixel ratio capped at 2 to conserve GPU memory and battery.
    - Debounced navigation callbacks (450ms) to trigger progressive geometry detail without flooding Web Workers.
    - Resilience: handles WebGL context loss (`webglcontextlost`) and restoration (`webglcontextrestored`), provides graceful fallback card for unsupported environments, and `.sr-only` descriptive summary for screen readers.
  - **UI Shell & Viewport Integration (`src/components/GraphViewport.tsx`, `src/App.tsx`, `src/styles/app.css`)**:
    - Replaced foundation placeholder with full `ThreeSceneController` canvas mounting and lifecycle cleanup.
    - Overlaid status pills, spinner indicator, reset button, and gesture hints.
    - Fixed desktop `.app-container` `height: 100vh; overflow: hidden;` so large derivations or panels do not push the canvas offscreen.
    - Handled responsive mobile layout with fixed graph viewport height (`520px`) and scrollable controls.
- **Important Files**:
  - Rendering engine: `src/rendering/types.ts`, `src/rendering/materials.ts`, `src/rendering/grid-axes.ts`, `src/rendering/scene-controller.ts`, `src/rendering/index.ts`
  - Viewport component: `src/components/GraphViewport.tsx`
  - Layout & styling: `src/App.tsx`, `src/styles/app.css`
  - Unit tests: `src/rendering/__tests__/scene-controller.test.ts`
  - Browser verification: `scripts/verify-v7-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npx vitest run`: PASSED (166/166 tests passing across all 13 test suites).
  - `npm run build`: PASSED (production bundle cleanly emitted in `dist/` with relative asset links).
  - `node scripts/verify-v7-browser.mjs`: PASSED (real headless Chromium with SwiftShader WebGL 2.0 against local preview server):
    1. Reference cylinder-plane: Translucent surfaces, exact ellipse curve, axes, initial framing.
    2. Orbit mouse drag: Camera smoothly orbits, dynamic lighting adapts.
    3. Reset View button: Restores initial origin-centered framing.
    4. Sphere-plane intersection: Translucent sphere, horizontal plane, exact circular intersection.
    5. Empty intersection ($z=0, z=10$): Two parallel planes rendered, zero fabricated curve, Global Emptiness badge.
    6. Plane-plane line intersection ($x+y+z=1, 2x-y+3z=2$): Straight line rendered across region without false closing segment.
    7. Mobile portrait ($390 \times 844$): Viewport and controls stack cleanly with zero page overflow.
    8. Subdirectory hosting (`http://localhost:4180/subpath/`): Verified.
    9. Network audit: 15/15 requests served locally, 0 external/remote requests.
  - Screenshots captured: `v7_reference_initial.png`, `v7_after_orbit.png`, `v7_after_reset.png`, `v7_sphere_plane.png`, `v7_empty_intersection.png`, `v7_line_intersection.png`, `v7_mobile_portrait.png`, `v7_subpath_hosting.png`.
- **Limitations / Deferred Work**:
  - MathLive virtual math keyboard is implemented in Phase V8.
  - Traversal animation (moving trace arrow along curve) and direction playback are deferred to Phase V9.
  - History persistence in IndexedDB is deferred to Phase V10.
  - Device/performance benchmarking and automated accessibility audits are deferred to Phase V11.
- **Next Phase**: V8 — Complete calculation UI and MathLive virtual keyboard (COMPLETED).

### Phase V8 — Complete calculation UI and MathLive virtual keyboard (2026-09-27)
- **Scope Implemented**:
  - **Local MathLive Virtual Keyboard & Font Assets (`src/mathlive/setup.ts`, `src/mathlive/types.ts`, `public/fonts/`)**:
    - Installed `mathlive@0.110.0` as a local project dependency with zero remote or CDN calls.
    - Bundled all 20 KaTeX `.woff2` font files into `public/fonts/` and configured `MathfieldElement.fontsDirectory` to resolve from base URL.
    - Set `MathfieldElement.soundsDirectory = null` to avoid 404s/network requests on virtual keyboard key clicks.
    - Configured keyboard layouts `['numeric', 'symbols', 'alphabetic', 'greek']`.
    - Script `scripts/prepare-pyodide.mjs` automatically copies MathLive fonts and generates `public/fonts/LICENSES.txt` (MIT for MathLive, SIL OFL-1.1 for KaTeX fonts).
  - **Encapsulated MathField React Component (`src/components/MathFieldInput.tsx`, `src/components/EquationInputSection.tsx`)**:
    - Wrapped `<math-field>` custom element in React lifecycle with ref forwarding (`MathfieldElement`).
    - Handled caret preservation, undo/redo stack protection, programmatic synchronization, and IME-safe Enter-to-calculate (`isComposing` guard).
    - Added dedicated virtual keyboard toggle button with SVG keyboard icon and `aria-label`/`aria-expanded`/`aria-controls`.
    - Implemented focus routing: clicking the keyboard button opens the virtual keyboard and immediately focuses the associated math-field.
  - **Orientation Controls & Traversal Direction (`src/components/DirectionToggle.tsx`, `src/App.tsx`)**:
    - Updated toggle UI with "Orientation" section label and Forward / Reverse buttons with `aria-pressed`.
    - Instant traversal swap without re-running Pyodide/SymPy solver: reparameterizes domain and formula instantly, renders Step 7 in derivation explaining the reflection/substitution, and maintains the current expanded/collapsed state of the derivation disclosure.
  - **Draft vs. Submitted Snapshot Policy (`src/components/ResultSection.tsx`, `src/App.tsx`)**:
    - Separated editable draft equation state from submitted snapshot state.
    - When inputs are edited after calculating, a restrained dirty notice (`● Draft edited • Result reflects calculated equations (...)`) appears above the result card across all result statuses.
    - 3D graph viewport and surface legend continue reflecting the submitted calculation until "Calculate Parameterization" is clicked.
    - Submitting a new calculation clears the dirty notice and updates 3D meshes and legend.
  - **Validation & Focus Handling (`src/components/EquationInputSection.tsx`, `src/App.tsx`)**:
    - Clear client-side validation errors displayed inline with `role="alert"`.
    - Predictable focus placement: automatically focuses the first invalid `<math-field>` on submission.
  - **Clean Educational Layout (`src/components/ResultSection.tsx`, `src/styles/app.css`, `src/styles/theme.css`)**:
    - Derivation disclosure is collapsed by default.
    - High-contrast, dark-mode mathfield styling matching reference palette (`#08090d` background, `#171a23` container, `#1f2433` input backgrounds, `#5b8ec7` surface F accent, `#8f94a0` surface G accent, `#8ab4f8` focus rings).
    - Removed non-functional history placeholder buttons in preparation for Phase V10.
  - **Responsive Design & Mobile Support**:
    - Optimized viewports: desktop split-screen (fixed canvas, scrollable controls), tablet, and mobile portrait ($390 \times 844$).
    - Zero horizontal overflow across all viewports.
    - Virtual keyboard docks cleanly at the bottom without obscuring the active input field.
  - **Static Delivery & Subpath Hosting**:
    - MIME type `font/woff2` supported in preview and static server scripts (`scripts/test-subdir-server.mjs`).
    - Clean subpath hosting verified under `/subpath/`.
- **Important Files**:
  - MathLive setup: `src/mathlive/setup.ts`, `src/mathlive/types.ts`
  - Input components: `src/components/MathFieldInput.tsx`, `src/components/EquationInputSection.tsx`, `src/components/DirectionToggle.tsx`
  - Result & layout: `src/components/ResultSection.tsx`, `src/App.tsx`, `src/styles/app.css`, `src/styles/theme.css`
  - Build/setup scripts: `scripts/prepare-pyodide.mjs`, `scripts/test-subdir-server.mjs`, `scripts/verify-v8-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npm test`: PASSED (166/166 tests passing across all 13 test suites).
  - `npm run build`: PASSED (production bundle emitted in `dist/` with local fonts in `dist/fonts/`).
  - `node scripts/verify-v8-browser.mjs`: PASSED (12 comprehensive checks in headless Chromium):
    1. Initial desktop reference composition: cylinder $x^2+y^2=4$ and plane $z=x+y$, exact ellipse curve, collapsed derivation.
    2. Virtual keyboard toggle: opens MathLive virtual keyboard, toggles between Surface F and Surface G, correctly positions and routes focus.
    3. Live symbolic solve: Pyodide/SymPy Web Worker generates exact curve and 6 educational derivation steps.
    4. Forward/Reverse toggle: instant traversal reparameterization, derivation disclosure remains expanded, Step 7 rendered explaining reversal.
    5. Draft vs. submitted state: editing input shows restrained dirty state banner while 3D scene and legend retain submitted equations.
    6. New calculation submission: $x^2+y^2=9$ submitted, dirty notice cleared, 3D meshes and legend updated.
    7. Proved empty intersection: $z=1$ and $z=2$ parallel planes render with mathematical proof banner.
    8. Degenerate point intersection: $x^2+y^2+z^2=1$ and $z=1$ tangent point handled without fabricating a curve.
    9. Validation error & predictable focus: syntax error highlights input and automatically focuses `surface-f-input`.
    10. Responsive viewports: tablet ($768 \times 1024$) and mobile portrait ($390 \times 844$) verified with zero horizontal overflow; mobile keyboard layout tested.
    11. Subpath hosting: verified under `http://localhost:4180/subpath/`.
    12. Static network audit: 11/11 requests served locally, 0 external/CDN requests.
  - Screenshots captured: `v8_01_reference_initial.png` through `v8_13_subpath_hosting.png`.
- **Limitations / Deferred Work**:
  - Traversal animation and custom curve color picker are implemented in Phase V9.
  - History persistence in IndexedDB with one-click restoration is deferred to Phase V10.
  - Automated accessibility audits (axe-core) and performance benchmarks are deferred to Phase V11.
- **Next Phase**: V9 — Traversal animation and active curve color customization (COMPLETED).

### Phase V9 — Traversal animation and active curve color customization (2026-10-02)
- **Scope Implemented**:
  - **Shared Appearance & Animation Contracts (`src/contracts/appearance.ts`, `src/contracts/index.ts`)**:
    - Defined `CurveAppearance` interface (`readonly curveColor: string`) capturing normalized opaque `#rrggbb` hex color, prepared for Phase V10 IndexedDB persistence.
    - Curated finite 8-color high-contrast palette (`CURVE_PALETTE`) calibrated for dark background (`#08090d`): Warm off-white (`#f5eedb`), Amber Gold (`#fbbf24`), Emerald Mint (`#34d399`), Coral Rose (`#fb7185`), Sky Cyan (`#38bdf8`), Lavender Violet (`#c084fc`), Tangerine Orange (`#fb923c`), and Orchid Magenta (`#e879f9`).
    - Implemented `getNextDefaultCurveColor(calculationIndex)`: deterministic sequential color allocator with graceful wraparound.
    - Implemented `isValidHexColor` and `normalizeHexColor` enforcing strict 6-digit opaque sRGB hex validation.
  - **Curve Animator Engine (`src/rendering/curve-animator.ts`)**:
    - Lifecycle management: `'unavailable' | 'ready' | 'playing' | 'paused' | 'finished'`.
    - Pacing: Calibrated 2600ms spatial arc-length pacing (`totalArcLength`), calculating cumulative Euclidean distance across drawable segments.
    - Monotonic clock: uses `performance.now()`, pauses elapsed time accumulation when tab is hidden (`visibilitychange`), preventing giant leaps upon tab reactivation.
    - Progressive reveal: reveals Line2 segments using `line.geometry.instanceCount = k` on preceding segments and a small dedicated dynamic `leadLine` for sub-segment head position, without rebuilding geometries or reallocating buffers per frame.
    - Gaps & poles preservation: strictly prevents bridging across disjoint intervals, parameter gaps, or singularities; `leadLine` is hidden and the arrow transitions seamlessly to the next segment in traversal order.
    - Direction arrow: Three.js cone mesh positioned at 3D head position with apex oriented along the local unit tangent vector. Dynamically scaled proportional to camera distance (`camDist * 0.007`) to remain crisp without dominating the graph. Handles stationary samples, cusps, and duplicates without NaN rotations.
    - Completion policy: displays full curve and retains a static direction cue arrow pointing along traversal at the curve head; zero indefinite autoplay loops.
    - Reduced motion: honors `prefers-reduced-motion: reduce` by showing the complete static curve and static direction cue immediately on load, while allowing user-initiated manual replay.
  - **Custom Curve Color Editor Component (`src/components/ColorEditorPopover.tsx`)**:
    - Compact, accessible modal popover (`role="dialog"`, `aria-modal="true"`, `aria-label="Edit curve color"`).
    - Single-click on swatch selects/focuses curve; double-click or explicit Edit icon button (`#edit-curve-color-btn`) opens the popover for discoverable touch and keyboard access.
    - Curated 8-color swatch grid with checkmark indicator and title tooltips.
    - Custom hex input field (`#curve-hex-input`) with live swatch preview. Validates 6-digit hex and rejects invalid input with inline error feedback without corrupting committed state.
    - Live preview: immediately previews color on 3D curve, direction arrow, swatch button, and legend marker. Translucent Surface F (`#5b8ec7`) and Surface G (`#8f94a0`) colors remain fixed.
    - Commit/cancel semantics: Apply button commits; Cancel button or Escape key cancels and restores initial color; outside-click commits currently previewed color and closes cleanly.
    - Focus management: traps Tab focus within popover; restores focus to trigger element on close.
    - Stale calculation binding: captured `calculationId` automatically closes popover if a new calculation completes while editing.
  - **Renderer & Viewport Integration (`src/rendering/scene-controller.ts`, `src/components/GraphViewport.tsx`, `src/App.tsx`, `src/styles/app.css`)**:
    - `ThreeSceneController` delegates curve reveal, playback, and arrow rendering to `CurveAnimator`.
    - Single rendering loop: playback frames and OrbitControls damping share the on-demand scheduler; loop sleeps when motion settles (0% idle CPU).
    - Top-right graph control button `#animation-playback-btn` dynamically reflects state: `Pause` while playing, `Resume` when paused, `Replay` when finished. Keyboard shortcut `Space` / `P` toggles playback; `R` resets camera view.
    - Direction toggle triggers instant reparameterization and re-traces the curve in reverse direction along $(0, 2\pi]$ with reversed arrow.
    - Replay uses existing geometry without re-solving equations or remeshing surfaces.
    - New calculation cancels prior animation, clears old callbacks/arrow, allocates the next default color, and auto-traces once.
    - Color survives replay, direction toggle, remeshing, and camera movement.
- **Important Files**:
  - Appearance contracts: `src/contracts/appearance.ts`, `src/contracts/index.ts`
  - Animator engine: `src/rendering/curve-animator.ts`, `src/rendering/types.ts`, `src/rendering/index.ts`
  - Scene controller & materials: `src/rendering/scene-controller.ts`, `src/rendering/materials.ts`
  - UI components: `src/components/ColorEditorPopover.tsx`, `src/components/GraphViewport.tsx`, `src/components/ResultSection.tsx`, `src/components/DirectionToggle.tsx`, `src/App.tsx`
  - Styling: `src/styles/app.css`
  - Tests & verification: `src/rendering/__tests__/curve-animator.test.ts`, `scripts/verify-v9-browser.mjs`
  - Documentation: `MASTER.md`, `docs/architecture.md`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npm test`: PASSED (176/176 tests passing across all 14 test suites in Vitest, including 10 curve animator & appearance tests).
  - `npm run build`: PASSED (production bundle emitted in `dist/`, base-path relative with `base: './'`).
  - `node scripts/verify-v9-browser.mjs`: PASSED (9 comprehensive real browser checks in Google Chrome with SwiftShader WebGL):
    1. Initial curve trace & replay controls: autoplays once, reveals curve with moving arrow, finishes with static cue (`v9_01_animation_mid_trace.png`, `v9_02_animation_complete.png`).
    2. Pause and resume: button click pauses ("Resume") and resumes ("Pause"); Space key toggles playback.
    3. Reverse traversal reparameterization: reparameterizes formula and domain $(0, 2\pi]$ and re-traces in reverse (`v9_03_reverse_traversal.png`).
    4. Custom curve color editor: swatch selection, live preview, Escape/cancel reversion, hex input validation, Apply commit, recolors curve (`v9_04_color_popover_open.png`, `v9_05_recolored_curve.png`).
    5. Live Pyodide solve & color allocation: solves $x^2+y^2=9$ cylinder-plane, auto-allocates `#fbbf24` (Amber Gold), traces with new color (`v9_06_new_calculation_alloc_color.png`).
    6. Reduced motion preference: skips autoplay, displays full curve immediately with static cue (`v9_07_reduced_motion.png`).
    7. Mobile portrait ($390 \times 844$): color popover contained within 228px width without overflow or clipping (`v9_08_mobile_color_editor.png`).
    8. Subpath hosting: verified under `http://localhost:4181/subpath/` (`v9_09_subpath_hosting.png`).
    9. Static network audit: 15/15 requests served locally, 0 external/remote requests.
- **Limitations / Deferred Work**:
  - Local history persistence in IndexedDB with one-click restoration, schema migration, and session recovery is deferred to Phase V10.
  - Automated accessibility audits (axe-core) and performance benchmarks are deferred to Phase V11.
- **Next Phase**: V10 — Local history and IndexedDB persistence (COMPLETED).

### Phase V10 — Local calculation history and IndexedDB persistence (2026-10-02)
- **Scope Implemented**:
  - **Versioned Persistence Contracts (`src/contracts/persistence.ts`, `src/contracts/index.ts`)**:
    - Defined schema versions: `CURRENT_PERSISTENCE_SCHEMA_VERSION = 1`, `CURRENT_RECORD_PAYLOAD_VERSION = 1`.
    - Defined `SavedCalculationRecord` capturing complete calculation snapshot: `id` (UUID), `schemaVersion`, `createdAt` (ISO timestamp), `request` (`CalculationRequest`: Surface F & G LaTeX, raw formulas, domain), `result` (`CalculationResult`: status, exact formula, domain, derivation steps, verification details), `appearance` (`CurveAppearance`: normalized `#rrggbb` hex color), and `direction` (`TraversalDirection`: `'forward' | 'reverse'`).
    - Enforced spatial/payload limits: `HISTORY_MAX_RECORDS = 100`, `HISTORY_MAX_RECORD_BYTES = 512 * 1024` (512 KiB per individual record), `HISTORY_TOTAL_BUDGET_BYTES = 5 * 1024 * 1024` (5 MiB total).
    - Implemented `HistoryListingSummary` and strict schema validation function `validateStrictSavedRecord` verifying all required fields and mathematical types.
  - **Storage Abstraction & Multi-Store Implementation (`src/persistence/`)**:
    - Interface `IHistoryStore` (`src/persistence/types.ts`) specifying atomic methods: `init()`, `list()`, `get(id)`, `save(record)`, `updateAppearance(id, appearance, direction)`, `delete(id)`, `clear()`, `close()`.
    - `IndexedDBHistoryStore` (`src/persistence/indexeddb-store.ts`):
      - Database `intersect_db` (version 1) with object store `calculations` and keyPath `id`.
      - Secondary indexes: `createdAt` (for reverse-chronological sorting and FIFO eviction) and `statusKind`.
      - Atomic transaction management: waiting for `tx.oncomplete` before resolving promises.
      - FIFO eviction: automatically trims records older than the 100-record capacity in the same transaction.
      - Multi-tab synchronization: broadcasts record changes via `BroadcastChannel('intersect_history_sync')`.
      - Connection management: handles `versionchange` events by cleanly closing the database.
    - `MemoryHistoryStore` (`src/persistence/memory-store.ts`):
      - Non-throwing in-memory fallback implementing `IHistoryStore` with `storageKind: 'degraded'`.
      - Activated when IndexedDB throws `SecurityError`, `QuotaExceededError`, or is unavailable (e.g. strict private browsing or disabled storage).
      - Retains 100-record capacity in-memory during the active browser session.
    - Legacy migration (`src/persistence/legacy-migration.ts`):
      - Idempotent migration from legacy `localStorage` keys into IndexedDB on first startup.
    - Validation utilities (`src/persistence/validation.ts`):
      - Byte size estimator `estimatePayloadByteSize` using `TextEncoder` with fallback.
      - Safe parser `safeValidateRecordItem` providing quarantine recovery for corrupted individual records.
  - **History Controller & React Hook (`src/persistence/history-controller.ts`, `src/persistence/useHistory.ts`)**:
    - Centralized singleton controller with async mutex locks to prevent race conditions during rapid calculations.
    - Tracks `activeRecordId` for in-place appearance and traversal direction updates on the currently active calculation without updating its creation timestamp or re-creating deleted records.
    - Multi-tab listeners notify React components of changes in other tabs.
  - **Accessible History Drawer UI (`src/components/HistoryDrawer.tsx`, `src/components/Header.tsx`, `src/styles/app.css`)**:
    - Header entry point `#history-drawer-toggle-btn` with calculation count pill badge and focus trigger preservation.
    - Slide-in side drawer (`role="dialog"`, `aria-modal="true"`, `aria-label="Calculation history"`, `z-index: 95`, solid `#13141b` background).
    - Accessible features: `Escape` key closes drawer and returns focus to the trigger button; Tab focus trapped inside drawer.
    - History items: Displays equations, status badge (`Solved`, `Empty`, `Degenerate`, `Inconclusive`, `Unsupported`, `Error`), relative and exact timestamps, color swatch, and traversal direction.
    - Single-click reopening: restores calculation immediately into active state and closes drawer.
    - Record deletion: individual item delete button (`.history-card-delete-btn`) with `stopPropagation` to prevent accidental restoration.
    - Clear all: bulk clear button with two-step confirmation prompt ("Confirm Clear?").
    - Storage indicator: shows "Storage: Local (IndexedDB)" or "Storage: Session Memory (Degraded)" banner.
  - **App Lifecycle Integration (`src/App.tsx`)**:
    - Auto-saves calculation record when Pyodide/SymPy solver produces a final outcome.
    - Direction or curve color changes update the active record in IndexedDB in-place without generating a duplicate.
    - One-click restoration: restores inputs, exact outcomes, derivation, direction, and curve color without re-running Pyodide/SymPy solver; regenerates 3D geometries dynamically from the restored mathematical formula.
- **Important Files**:
  - Contracts: `src/contracts/persistence.ts`, `src/contracts/index.ts`
  - Persistence layer: `src/persistence/indexeddb-store.ts`, `src/persistence/memory-store.ts`, `src/persistence/history-controller.ts`, `src/persistence/legacy-migration.ts`, `src/persistence/validation.ts`, `src/persistence/types.ts`, `src/persistence/useHistory.ts`, `src/persistence/index.ts`
  - UI components: `src/components/HistoryDrawer.tsx`, `src/components/Header.tsx`, `src/App.tsx`
  - Styling: `src/styles/app.css`
  - Tests: `src/persistence/__tests__/history.test.ts`
  - Browser verification: `scripts/verify-v10-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npx vitest run`: PASSED (192/192 tests passing across all 15 test suites, including 16 persistence tests).
  - `npm run build`: PASSED (production bundle emitted in `dist/` with relative paths, Pyodide runtime in `dist/pyodide/`, fonts in `dist/fonts/`).
  - `node scripts/verify-v10-browser.mjs`: PASSED (8 real headless Chromium browser checks with SwiftShader WebGL):
    1. Initial empty state & Esc focus return (`v10_01_empty_history.png`).
    2. Calculation save: $x^2+y^2=9, z=x+y$, Emerald Mint `#34d399`, Reverse traversal saved in IndexedDB (`v10_02_saved_calculation_in_history.png`).
    3. Reload & one-click restore: Verified inputs, Reverse direction, exact formula & domain, `#34d399` color, 3D curve displayed, `workerSolvedAgain: false` (`v10_03_drawer_after_reload.png`, `v10_04_restored_calculation_graph.png`).
    4. Proved empty outcome: $z=1, z=5$ saved with `Empty` status badge (`v10_05_history_with_empty_outcome.png`).
    5. Row deletion and bulk clear: Individual record deleted; clear all with confirmation modal emptied store (`v10_06_cleared_history.png`).
    6. Mobile portrait ($390 \times 844$): Drawer fits within 343px $\le$ 390px without horizontal overflow (`v10_07_mobile_history_drawer.png`).
    7. Subpath hosting: Verified under `http://localhost:4180/subpath/` (`v10_08_subpath_hosting.png`).
    8. Static network audit: 34 requests served locally, 0 external/remote requests.
- **Limitations / Deferred Work**:
  - Performance budgets (60fps animation, memory leak audits, adaptive detail throttling) and automated accessibility audits (axe-core WCAG 2.1 AA) are deferred to Phase V11.
  - Final regression suite, license verification, and release preparation are deferred to Phase V12.
- **Next Phase**: V11 — Performance and accessibility (COMPLETED).

### Phase V11 — Performance and accessibility hardening (2026-10-02)
- **Scope Implemented**:
  - **Performance Benchmarking & Budgets (`docs/performance-budgets.md`, `scripts/benchmark-workloads.mjs`)**:
    - Established strict performance budgets across 8 representative mathematical workloads (linear planes, quadratic cylinders, hyperbolic paraboloids, quartic spheres, transcendental surfaces, disjoint planes, coincident surfaces, and narrow parameter bounds).
    - Recorded baseline benchmark (`docs/baseline-benchmark.json`) and final post-optimization benchmark (`docs/final-benchmark.json`).
  - **Worker Decoupling & Bundle Optimization (`vite.config.ts`, `src/math/curve-parser.ts`, `src/math/__tests__/curve-parser.test.ts`)**:
    - Identified that `src/geometry/curve-sampler.ts` was importing from `src/math/parser.ts`, causing `@cortex-js/compute-engine` (3.4 MB) to be bundled into `geometry.worker.ts`.
    - Created lightweight, zero-dependency mathematical AST parser (`src/math/curve-parser.ts`) specifically for fast runtime curve parameter evaluation in worker threads.
    - Decoupled `geometry.worker.ts`, dropping its bundle size from **3,414 KB to 35.2 KB** (a **99.0% reduction**).
    - Configured modular chunk splitting (`manualChunks`) in `vite.config.ts` for `three`, `mathlive`, `@cortex-js/compute-engine`, and `react`, reducing the main entry chunk from **5,160 KB to 155 KB** (gzip: 44.9 KB).
  - **Idle Render Loop Sleeping (`src/rendering/scene-controller.ts`)**:
    - Overhauled `ThreeSceneController.loop()` to detect damping settle states (`controls.update() === false` and camera/target squared deltas `< 1e-5`).
    - Verified that upon settling, `requestAnimationFrame` stops entirely (0 rAFs in 600ms idle window, dropping CPU utilization to 0% at rest).
    - Seamlessly wakes up on user pointer drag, wheel zoom, window resize, or trajectory animation playback.
  - **Adaptive Geometry Quality Toggle (`src/components/GraphViewport.tsx`, `src/App.tsx`)**:
    - Added user/device resolution toggle (`Detail: Standard` with 64-division marching cubes vs `Detail: Draft` with 40-division marching cubes).
    - Preserves camera orientation, pan/zoom position, and committed color while switching sampling resolution without re-solving the mathematical intersection.
  - **Accessibility Hardening (`src/components/DirectionToggle.tsx`, `src/components/MathFieldInput.tsx`, `src/components/ColorEditorPopover.tsx`, `src/styles/theme.css`)**:
    - Upgraded Direction Toggle to WAI-ARIA `role="radiogroup"` with `role="radio"`, `aria-checked`, roving tabindex (`tabIndex={0}` for active, `-1` for inactive), and arrow key navigation (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`).
    - Added accessible instructions (`aria-describedby`) and `aria-label` to Surface F and Surface G equation inputs.
    - Added global Escape key listener and focus management to `ColorEditorPopover` ensuring accessible dialog dismissal and focus restoration to the trigger button.
    - Styled global `:focus-visible` focus rings (`outline: 2px solid #60a5fa; outline-offset: 2px`) for keyboard navigability across all interactive elements.
    - Implemented `@media (prefers-reduced-motion: reduce)` rules in `src/styles/theme.css` to eliminate jarring transitions and disable auto-play on load.
- **Important Files**:
  - Performance budgets & benchmark: `docs/performance-budgets.md`, `scripts/benchmark-workloads.mjs`, `docs/baseline-benchmark.json`, `docs/final-benchmark.json`
  - Zero-dependency curve parser: `src/math/curve-parser.ts`, `src/math/__tests__/curve-parser.test.ts`
  - Geometry worker & decoupling: `src/geometry/curve-sampler.ts`, `src/geometry/geometry.worker.ts`
  - Render loop sleep: `src/rendering/scene-controller.ts`
  - Adaptive resolution: `src/components/GraphViewport.tsx`, `src/App.tsx`
  - Accessibility & UI components: `src/components/DirectionToggle.tsx`, `src/components/MathFieldInput.tsx`, `src/components/ColorEditorPopover.tsx`, `src/styles/theme.css`
  - Build configuration: `vite.config.ts`
  - Browser verification suite: `scripts/verify-v11-browser.mjs`
- **Commands & Outcomes**:
  - `npm run typecheck`: PASSED (0 errors, strict mode enabled).
  - `npm run test`: PASSED (199/199 tests passing across 16 test suites, including 7 new curve parser tests).
  - `npm run build`: PASSED (Emitted main chunk: 155.4 KB [<= 250 KB budget], Geometry worker: 35.2 KB [<= 120 KB budget], SymPy worker: 90.2 KB [<= 120 KB budget]).
  - `node scripts/verify-v11-browser.mjs`: PASSED (10 real Chromium browser checks with SwiftShader WebGL 2.0):
    1. Emitted asset budgets audit: PASSED.
    2. Input field accessibility semantics: PASSED.
    3. Direction radiogroup arrow navigation & roving focus: PASSED.
    4. Adaptive detail toggle preserves exact formula & domain: PASSED.
    5. Idle render loop sleeping (0 rAFs, 0% CPU): PASSED.
    6. `prefers-reduced-motion` compliance: PASSED.
    7. Color editor focus trap, Escape dismiss, and focus restoration: PASSED.
    8. Mobile portrait layout (390x844) without horizontal overflow: PASSED.
    9. Subpath hosting under `/subpath/`: PASSED.
    10. Static network audit (0 external requests): PASSED.
- **Limitations / Deferred Work**:
  - Final regression suite, license verification, user documentation, and release preparation are deferred to Phase V12.
- **Next Phase**: V12 — Release preparation, regression verification, and final handoff (COMPLETED).

### Phase V12 — Final verification and release preparation (2026-10-02)
- **Scope Implemented**:
  - **Visual & Usability Polish (Section 4)**:
    - Removed obsolete prototype debug UI (`ContractInspectModal`) and stale "V10" badge from `Header.tsx` and `App.tsx`.
    - Preserved minimal, restrained, dark-themed hierarchy matching visual reference `docs/reference/20308.png`: dominant 3D graph, translucent dual surfaces (Surface F blue `#5b8ec7`, Surface G neutral `#8f94a0`), high-contrast active curve (`Line2` screen-space geometry with direction cone), and legend bar.
    - Verified single-click focus/selection, double-click or explicit button editing for custom curve color, and responsive drawer/popover focus trapping and Escape dismissal.
  - **Mathematical Regression Gate (Section 5 Matrix)**:
    - Created comprehensive regression suite `src/runtime/__tests__/v12-mathematical-regression.test.ts` (22 tests) verifying all 9 core mathematical criteria:
      1. Plane/plane intersection lines, inconsistent parallel planes, and dependent coincident planes.
      2. Reference cylinder/plane closed curve ($x^2+y^2=4, z=x+y$) and translated/scaled equivalent ($(x-3)^2+(y+2)^2=9, z=2x-y+1$).
      3. Oblique plane/sphere section and quadric-quadric sphere/sphere reduction to radical cutting plane.
      4. Paraboloid ($z=x^2+y^2, y=x$), elementary non-polynomial curve ($z=\sin x, y=\cos x$), and hyperbola / domain-gap pole separation ($y=1/x, z=x$).
      5. Original-denominator exclusions ($x \neq 0$) preserved across simplification.
      6. Isolated point quadric tangencies ($x^2+y^2+z^2=9, z=3$), real-empty sums of squares, and bounded-empty exclusions outside $[-1000, 1000]^3$.
      7. Controlled inconclusive fallback for high-degree unsupported varieties without fabricating absence proofs.
      8. Forward / Reverse domain mapping for periodic closed intervals $[0, 2\pi) \to (0, 2\pi]$ and finite line segments $[a, b] \to [a, b]$.
      9. Invariance under equation swapping, equation rearrangement, non-zero constant scaling, and coordinate permutation.
  - **Static Network Independence & Local Host Audit (Section 7)**:
    - Verified strict 0 external network requests across root hosting and subpath hosting (`/subpath/`).
    - Verified all Pyodide WebAssembly binaries, stdlib zip, SymPy/Mpmath wheels, MathLive KaTeX fonts, and UI scripts load purely from same-origin static paths (`./assets/`, `./pyodide/`, `./fonts/`).
    - Confirmed no remote CDNs, hosted solvers, telemetry, analytics, or external font providers.
  - **End-to-End Real Browser Verification (Section 6 Matrix)**:
    - Executed automated Chromium harness `scripts/verify-v12-release.mjs` verifying:
      1. Fresh symbolic calculation of reference cylinder-plane with 6 educational derivation steps.
      2. Instant direction reversal (Forward -> Reverse, domain $(0, 2\pi]$, Step 7 derivation).
      3. Active curve custom color editor popover, live preview, and commit without re-solving.
      4. Warm subsequent calculation (Paraboloid $z=x^2+y^2, y=x$).
      5. Proved empty bounded intersection ($x^2+y^2+z^2=1, z=5$).
      6. Degenerate isolated point intersection ($x^2+y^2+z^2=4, z=2$).
      7. Input syntax error diagnostics and focus return.
      8. IndexedDB calculation history: saving, one-click restoration without re-solving (`workerSolvedAgain: false`), single row deletion, and bulk clear.
      9. Idle 3D render loop shutdown (0 rAFs in 600ms idle window, 0% CPU at rest).
      10. Responsive layouts on Desktop ($1280 \times 800$), Tablet ($768 \times 1024$), and Mobile ($390 \times 844$) without horizontal page overflow.
      11. Subpath hosting under `http://localhost:4184/subpath/`.
  - **Open-Source License & Redistribution Asset Inventory (Section 9)**:
    - Created `THIRD-PARTY-LICENSES.md` (and mirrored in `dist/THIRD-PARTY-LICENSES.md`):
      - Pyodide 0.27.8 (MPL-2.0)
      - CPython 3.12.7 (PSF-2.0)
      - SymPy 1.13.3 (BSD-3-Clause)
      - mpmath 1.3.0 (BSD-3-Clause)
      - Three.js 0.186.1 (MIT)
      - MathLive 0.110.0 (MIT)
      - KaTeX Fonts (SIL OFL-1.1)
      - CortexJS Compute Engine 0.136.2 (MIT)
      - React & React-DOM 19.3.0 (MIT)
  - **Reproducible Static Release Package (Section 8)**:
    - Created distributable archive `dist-release/intersect-static-v1.0.0.tar.gz` (14.51 MB).
    - Calculated SHA-256 checksum: `88b452d2b30dbff1b4191b79710d573379541beeb4d300df3e27b32bc055c0bd`.
    - Emitted release manifest: `dist-release/release-manifest.json`.
    - Verified archive extraction and file integrity in a clean staging environment.
  - **Complete Documentation (Section 10)**:
    - Overhauled `README.md` with complete capabilities, input conventions, mathematical boundaries, setup commands, static hosting guidelines, license summary, and architecture links.
- **Verification Commands & Real Outcomes**:
  - `npm run typecheck` (`tsc --noEmit`): PASSED (0 errors, strict mode enabled).
  - `npm run test` (`vitest run`): PASSED (221/221 tests passing across 17 test suites, including 22 V12 mathematical regression tests).
  - `npm run build` (`npm run prepare:runtime && tsc --noEmit && vite build`): PASSED:
    - Main entry chunk: 149.9 KB (budget <= 250 KB).
    - Geometry worker: 34.4 KB (budget <= 120 KB).
    - SymPy worker: 88.0 KB (budget <= 120 KB).
    - Pyodide assets: 17.55 MB across 7 files with SHA-256 verification.
  - `node scripts/verify-v12-release.mjs`: PASSED (all 6 stages and 11 end-to-end flows passed; 11 screenshots captured in `brain/b0660780-c59d-434b-98b3-dacf2f250e3f`).
  - Network audit: 0 external requests across all tests and browser sessions.
- **Next Phase**: V12 Follow-Up — Rendering, interface, localization, and offline PWA (COMPLETED).

### Phase V12 Follow-Up — Rendering, interface, localization, and offline PWA (2026-10-02)
- **Scope Implemented**:
  - **Numbered, Legible 3D Coordinate References (Section 3)**:
    - Implemented `CoordinateFrameManager` in `src/rendering/grid-axes.ts` creating thick 3D cylinder axes for X (red `#e05252`), Y (green `#38a169`), and Z (blue `#3182ce`), complete with directional arrowheads and axis end labels.
    - Dynamic zoom-dependent tick marks (1/2/5 × 10^k steps) formatted for active locale.
    - Screen-stable origin marker "0". Collisions and offscreen labels bounded via screen-space distance checking.
    - Canvas-based text sprite caching avoiding continuous DOM/canvas allocations during orbit/pan/zoom.
    - Preserved initial reference region $[-50, 50]^3$ and calculation bounds $[-1000, 1000]^3$.
  - **Surface Rendering, Smooth Shading & Coordinate Guides (Section 4)**:
    - Eliminated faceted checkerboard triangles via global edge-vertex welding using 32-bit `edgeKey` hashing in `src/geometry/marching-cubes.ts`.
    - Computed continuous implicit gradient normals from compiled evaluators, yielding smooth lighting across curved surfaces.
    - Added subtle GeoGebra-style coordinate guide lines (`src/geometry/guide-curves.ts`) along coordinate grid planes, utilizing depth bias (`polygonOffset`) to eliminate z-fighting.
    - Sized and refined the direction arrow cue (`src/rendering/curve-animator.ts`) from 1.6 to 0.7 units with dynamic screen-bounded scaling.
  - **Themes: Auto / Light / Dark (Section 5)**:
    - Created token-based design system in `src/styles/theme.css` and `src/styles/theme.ts`.
    - Auto mode follows system `prefers-color-scheme` initially; explicit Light or Dark selection persists in localStorage.
    - Synchronized WebGL scene colors (`setTheme('dark' | 'light')`) without page reload or calculation reset.
    - Custom sleek scrollbars (`scrollbar-width: thin`, custom `::-webkit-scrollbar` styling).
  - **Icons & Interaction Polish (Section 6)**:
    - Integrated bundled open-source `lucide-react` icons (Play, Replay, ArrowRight, ArrowLeft, Moon, Sun, Monitor, Languages, History, Layers, Maximize2, Download, Pencil).
    - Removed redundant boilerplate text ("Free-form equation • MathLive...", routine "Verified" banners, "REFERENCE CALCULATION RESULT").
    - Native MathLive LaTeX typography for exact formula $\mathbf{r}(t)$ and parameter interval in `ResultSection.tsx`.
  - **Mobile Layout & Virtual Keyboard (Section 8)**:
    - Bottom-docked MathLive keyboard with expand/collapse toggle affordance.
    - Scoped touch gestures preventing viewport rotation when interacting with controls or history.
  - **Localization: Spanish Default with English Switch (Section 9)**:
    - Default language: Spanish (`es`) on first visit regardless of browser language; English (`en`) switch.
    - Persisted explicit user language choice in localStorage.
    - Structured localization dictionaries (`src/i18n/index.ts`) translating all UI controls, error diagnostics, derivation steps, scope descriptions, and accessibility labels.
  - **Full Offline Installable PWA (Section 10)**:
    - Automatic background preparation starts on first visit without confirmation prompt or manual opt-in.
    - Complete runtime closure precached via Service Worker (Pyodide WASM, SymPy/Mpmath wheels, stdlib zip, MathLive KaTeX fonts, Three.js, workers, bundles, icons).
    - Valid cache reused across visits.
    - Service Worker caching strategy: cache-first with stale-while-revalidate / cache-only offline fallback.
  - **Original Vector SVG Branding & Complete Icon Suite (Section 11)**:
    - Original abstract intersection curve motif (`src/components/Logo.tsx`, `public/logo.svg`, `public/favicon.svg`).
    - Local PNG icon suite generated: `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png`.
    - `manifest.webmanifest` and publication HTML metadata.
  - **Cloudflare Pages Publication Readiness (Section 12)**:
    - Static HTML structure and metadata prepared for future Cloudflare Pages hosting.
    - Domain-dependent canonical/OG URLs honestly omitted until exact public hostname is configured. No deployment or publication performed.
- **Verification Commands & Real Outcomes**:
  - `npm test`: PASSED (221/221 tests passing across 17 test suites).
  - `npm run build`: PASSED (production bundle built, `cache-manifest.json` generated with 50 assets).
  - `node scripts/verify-v12-followup.mjs`: ALL 8 TESTS PASSED:
    - Test 1 (Spanish default, dark theme initial shell): PASSED.
    - Test 2 (Theme switching to Light mode): PASSED.
    - Test 3 (Language switching to English): PASSED.
    - Test 4 (Mobile responsive layout & virtual keyboard): PASSED.
    - Test 5 (PWA Service Worker cache completeness with 51 cached items): PASSED.
    - Test 6 (100% offline reload + fresh unseen symbolic calculation of $x^2+y^2+z^2=9$ and $z=1$): PASSED ($\mathbf{r}(t) = (-2\sqrt{2}\sin t, 2\sqrt{2}\cos t, 1)$).
    - Test 7 (Saddle surface $z=x^2-y^2, z=0$ smooth rendering and guides): PASSED ($\mathbf{r}(t) = (t, t, 0)$).
    - Test 8 (Package static release archive): PASSED (`dist-release/intersect-static-v1.0.0.tar.gz`, 14.66 MB, SHA-256: `59587043a70a8d86...`).
  - Network audit: 0 remote runtime requests across all tests and browser sessions.
- **Artifacts Generated & Verified**:
  - `followup_01_spanish_default_dark.png`
  - `followup_02_light_theme_spanish.png`
  - `followup_03_english_light_theme.png`
  - `followup_04_mobile_keyboard.png`
  - `followup_05_true_offline_fresh_calculation.png`
  - `followup_06_saddle_surface_smooth.png`
- **Next Phase**: V12 Visual & Interaction Refinements (COMPLETED).

### Phase V12 Visual & Interaction Refinements (2026-10-02)
- **Scope Implemented**:
  - **1. Full Spanish Localization of Derivations (`src/i18n/index.ts`, `src/components/ResultSection.tsx`, `src/App.tsx`)**:
    - Translated all mathematical derivation steps into Spanish (`getLocalizedStepTitle`, `getLocalizedStepExplanation`).
    - Changed orientation buttons from "Directa" / "Inversa" to "Anversa" / "Reversa" (English: "Forward" / "Reverse").
    - Removed technical boilerplate ("Alcance: Single continuous closed ellipse component").
    - Replaced disclosure label with "Ver procedimiento" / "Ocultar procedimiento" (English: "View procedure" / "Hide procedure").
  - **2. Planar Triangle Artifact Elimination (`src/geometry/marching-cubes.ts`, `src/geometry/guide-curves.ts`, `src/rendering/materials.ts`)**:
    - Enforced consistent triangle face winding matching analytic gradient normals (`(p1 - p0) x (p2 - p0) · N_grad > 0`, swapping indices if negative). This eliminated the alternating normal inversion caused by Three.js `DoubleSide: true` lighting.
    - Restricted guide curve coordinate slicing to at most 2 orthogonal families (Z and dominant horizontal axis X or Y). Slicing 3 families previously created a triangular lattice across flat planes; 2 families produces clean orthogonal quads like graph paper.
    - Set silky smooth matte material properties (`roughness: 0.65`, `metalness: 0.02`).
  - **3. Virtual Keyboard Lifecycle (`src/components/MathFieldInput.tsx`)**:
    - Configured virtual keyboard to only open automatically upon tapping on touch devices (`pointer: coarse`).
    - On desktop, keyboard is only opened explicitly by clicking the keyboard icon button.
    - Automatically closes virtual keyboard and blurs field when clicking anywhere outside the active field and keyboard panel (on both desktop and mobile).
  - **4. Debounced Auto-Calculate While Typing (`src/App.tsx`)**:
    - Added 450ms debounced auto-calculation effect that validates equations via `prepareCalculationRequest` and triggers calculation automatically while typing without requiring a manual click on "Calcular".
  - **5. Camera Zoom & Non-Overlapping Axis Ticks (`src/rendering/scene-controller.ts`, `src/rendering/grid-axes.ts`)**:
    - Reduced framing radius from $86.6$ to $15.0$, positioning the camera closer ($\approx 38$ units) to fill the canvas without void borders.
    - Compacted axis tick label sprites to $1.5 \times 0.75$, enabled `depthTest: true`, and enforced a minimum spacing ($\ge 4$ units) to prevent collisions.
  - **6. Step Badges & Left Panel Button Redesign (`src/components/ResultSection.tsx`, `src/styles/app.css`)**:
    - Compact circular step badges (`.step-number-badge`, $20\text{px} \times 20\text{px}$) with bold step numbers.
    - Modern animated down arrow for the procedure disclosure.
    - Modern segmented control styling for "Anversa" and "Reversa" traversal directions.
  - **7. Pixel-Perfect Header & Logo Container (`src/components/Header.tsx`, `src/styles/app.css`)**:
    - Structured brand row with dedicated 36px `.brand-logo-container` elevating the vector SVG logo.
    - Compact toolbar buttons for PWA Install, Theme toggle, Language toggle, and History count badge.
  - **8. GeoGebra Mobile Layout (`src/styles/app.css`, `src/components/ColorEditorPopover.tsx`)**:
    - Mobile breakpoint (`@media (max-width: 900px)`): 3D graph viewport positioned on top (`order: 1`, $44\text{vh}$), with inputs, settings, and derivation panel scrollable beneath (`order: 2`).
    - Fixed initial mount focus bug in `ColorEditorPopover` (`wasOpenRef`), eliminating unwanted auto-scroll jumps on mobile load.
- **Verification Commands & Real Outcomes**:
  - `npm test`: PASSED (221/221 tests passing across 17 test suites).
  - `npm run build`: PASSED (production bundle built, 50 assets precached in `cache-manifest.json`).
  - Headless Chromium verification:
    - `mobile_initial_view_fixed.png`: 3D graph viewport on top, inputs below, no scroll offset (`containerScrollTop: 0`).
    - `mobile_derivation_expanded.png`: Compact step badges, Spanish step titles and explanations, "Ocultar procedimiento".
    - `followup_01_spanish_default_dark.png`: Smooth planar surface without triangles, clean close-up zoom, legible axes, Anversa/Reversa buttons, and aligned brand logo.

### Phase V12 Live 3D Graph & Explicit Calculate Resolution (2026-10-02)
- **Scope & User Requirements**:
  - **Issue Reported**: The 3D graph view was not updating when typing equations into Surface F/G, nor when clicking "Calcular".
  - **Desired Architecture**: Live 3D surfaces updating dynamically as the user types; exact intersection curve $\mathbf{r}(t)$ calculated and drawn only upon explicit user click on "Calcular".
- **Implementation Details (`src/App.tsx`, `src/components/GraphViewport.tsx`)**:
  - **Live Surface Geometry (`src/App.tsx`)**:
    - Decoupled 3D surface mesh generation from the SymPy calculation snapshot: `debouncedSurfaceF` and `debouncedSurfaceG` evaluate input equations into residual ASTs via `prepareSurfaceEquation` with fallback to `lastValidFASTRef` / `lastValidGASTRef`.
    - `geometryRequest` evaluates dynamic inputs into `geometry.worker.ts`, generating updated 3D meshes within ~25ms on every keystroke.
  - **Conditional Curve Rendering (`src/App.tsx`)**:
    - While inputs are dirty (`isDraftDirty = true`), `geometryRequest.curve` is set to `null`, hiding mismatched curves while typing.
    - $\mathbf{r}(t)$ is only calculated, verified, and sent to `geometryRequest` when the user explicitly clicks "Calcular".
  - **Unblocked "Calcular" Submission & Background Pre-Warming (`src/App.tsx`)**:
    - Eagerly pre-warms the Pyodide/SymPy Web Worker on mount (`init().catch(...)`).
    - Removed `|| isInitializing` from the `handleCalculate` early-exit guard and button `disabled` prop so clicks during runtime startup are not discarded, providing clear status feedback (`"Inicializando Pyodide y resolviendo..."`) and calculating seamlessly once ready.
  - **Dynamic Viewport Legend (`src/App.tsx`, `src/components/GraphViewport.tsx`)**:
    - Passed `debouncedSurfaceF` and `debouncedSurfaceG` to `GraphViewport` props so the on-canvas legend updates live during equation edits.
- **Verification Commands & Real Outcomes**:
  - `npm test`: PASSED (221/221 tests passing across 17 test suites).
  - `npm run build`: PASSED (production bundle built, 50 assets precached in `cache-manifest.json`).
  - Headless Chromium verification:
    - `live_01_initial_cylinder4.png`: Initial reference cylinder $r=2$, plane $z = x + y$, and intersection ellipse.
    - `live_02_typed_cylinder9_live_surface.png`: Typing `x^2 + y^2 = 9` dynamically updates the 3D cylinder mesh live to radius 3; curve is hidden while draft is uncalculated.
    - `live_03_calculated_r_of_t_with_curve.png`: Clicking "Calcular" solves exact $\mathbf{r}(t) = (3\cos t, 3\sin t, 3\cos t + 3\sin t)$ and draws the new intersection curve on the expanded cylinder.
    - `live_04_surface_g_tilted_plane_live.png`: Typing `z = 2*x` into Surface G tilts the plane in real time in the 3D viewport.
    - `live_05_surface_g_calculated_curve.png`: Clicking "Calcular" computes and renders the new ellipse curve for $x^2 + y^2 = 4$ and $z = 2x$.
- **Next Phase**: Parameterization Solver Robustness & Global Coverage Engine (COMPLETED).

### Phase V13 Parameterization Solver Robustness & Global Coverage Engine (2026-10-02)
- **Scope & User Requirements**:
  - Prevent the parameterization solver from ever accepting partial branches, semicircles, or subsets of an intersection curve as the final solution.
  - Implement two distinct, mandatory validation phases in the solving pipeline:
    1. $\boxed{\text{¿satisface las ecuaciones?}}$: Substitute $\mathbf{r}(t)$ into both surfaces $F=0$ and $G=0$ and verify symbolic simplification identically to zero across the domain.
    2. $\boxed{\text{¿representa toda la intersección?}}$: Verify that $\mathbf{r}(t)$ represents the entire intersection curve component, checking for dropped conjugate $\pm$ branches, even roots ($\sqrt{\cdot}$) restricting sign/range, coordinate parameterizations on closed curves, division by zero, and opposite-sign witness points.
  - Mandatory regression case: for $F: x^2 + y^2 = 4$ and $G: z = \sin(xy)$, reject $(t, \sqrt{4-t^2}, \sin(t\sqrt{4-t^2}))$ (covers only $y \ge 0$) and return $\mathbf{r}(t) = (2\cos t, 2\sin t, \sin(2\sin 2t)), \; t \in [0, 2\pi)$.
  - Exact real parameter domain determination: never default blindly to $\mathbb{R}$. Compute bounds from even-root radicands, denominators, log arguments, and bounds clipping. Closed periodic curves must return the fundamental period $[0, 2\pi)$ without duplicating or wrapping multiple times.
  - Educational honesty (Rule 8): if an intersection requires multiple branches or disconnected components (e.g. $x^2 + y^2 = 4$ and $z^2 = 1$ yielding two disjoint circles $z = \pm 1$) and no single exact global parameterization exists, do NOT fabricate or present a single branch as complete; return `status: 'inconclusive'`, `reasonCode: 'multiple_branches_no_global_parametrization'`.
  - Apply `Forward / Reverse` orientation after obtaining the complete parameterization without altering the represented geometric set.
  - Parity: the 3D scene renders the exact same formula and domain presented to the user.
- **Architectural Implementation**:
  - `src/runtime/sympy_builder.py`:
    - Implemented `is_closed_variety_check(F_res, G_res)` to detect whether the variety contains a closed loop component (e.g. cylinders, spheres, or variable eliminations yielding ellipses/circles).
    - Implemented `determine_parameter_domain(rx, ry, rz, is_periodic, domain_conds, bounds)`: strictly computes the real domain $D$ through radicand sign partitioning, denominator singularities, bounds clipping, and $[0, 2\pi)$ fundamental periodic domains.
    - Implemented `validate_symbolic_identities(rx, ry, rz, F_res, G_res, intervals)`: evaluates $F(\mathbf{r}(t)) \equiv 0$ and $G(\mathbf{r}(t)) \equiv 0$ symbolically with trigonometric simplification and numerical identity verification fallbacks.
    - Implemented `validate_global_coverage(candidate, F_res, G_res, bounds, is_closed_curve)`: enforces global coverage, rejects Cartesian parameterizations on closed varieties, rejects dropped conjugate branches, and performs opposite-sign witness point tests on sign-constrained roots.
    - Replaced `solve_cylinder_plane_system` with `solve_cylinder_surface_system`: handles general non-planar cutting surfaces (e.g. $z = \sin(xy)$) slicing cylinders/ellipses, parameterizing cross-sections into trigonometric coordinates on $[0, 2\pi)$ and solving for remaining coordinates.
    - Updated `solve_coordinate_parameterization` and `solve_intersection_core` to enforce the full two-stage validation pipeline and return `multiple_branches_no_global_parametrization` when multiple disconnected components exist.
    - Fixed cylinder symbol ordering so that spatial variables are consistently ordered $(x, y, z)$, guaranteeing $x = R\cos t, y = R\sin t$.
  - `src/runtime/python-source.ts`:
    - Synchronized with Python source via automated `scripts/sync-python-source.mjs` script.
  - `src/runtime/__tests__/v13-global-coverage-solver.test.ts`:
    - Created 10 new comprehensive automated tests covering the mandatory regression case ($x^2+y^2=4$ and $z=\sin(xy)$ forward & reverse), circles/ellipses with planar and non-planar surfaces, $\pm\sqrt{\cdot}$ rejection, disconnected components ($x^2+y^2=4$ and $z^2=1$), open curves with singularity exclusions ($z=1/x, y=0$), and periodic fundamental domain guarantees.
  - `src/runtime/__tests__/v4-solver.test.ts`:
    - Updated concentric sphere-cylinder test to assert `inconclusive` (`multiple_branches_no_global_parametrization`) for two disconnected circles ($z = \pm 2\sqrt{3}$) and added tangent sphere-cylinder test for single circle ($z=0$).
- **Verification Commands & Real Outcomes**:
  - `npm run typecheck`: PASSED with 0 errors (`tsc --noEmit`).
  - `npx vitest run src/runtime/__tests__/v13-global-coverage-solver.test.ts`: PASSED (10/10 tests passing).
  - `npm test`: PASSED (232/232 tests passing across all 18 test suites).
  - `npm run build`: PASSED (production bundle built, 50 assets precached in `cache-manifest.json`).
- **Next Phase**: All requested solver corrections and validations completed and fully verified. Ready for user feedback.

### Automatic Calculation, Complete Localization & 3-Tier Graphic Quality (2026-10-03)
- **Scope & User Requirements**:
  1. **Cálculo automático**: Completely eliminated the "Calcular" button (`#calculate-action-btn`). Automatically recalculates $\mathbf{r}(t)$, derivation steps, and 3D curve representation on every valid equation change in Surface F or G, using a 400ms debounce to prevent computation churn while typing.
  2. **Localización completa**: Zero hardcoded strings or mixed-language states. Entire UI, procedure steps, explanations, labels, errors, aria attributes, math-field diagnostics, tooltips, and dynamic notices are 100% Spanish in `ES` and 100% English in `EN`.
  3. **Calidad gráfica**: Reused the existing "Detalle" control to provide exactly three levels: `Bajo` / `Low`, `Medio` / `Medium`, and `Alto` / `High` (**default**). Each level has its own distinct icon (`Zap`, `Layers`, `Sparkles`) and genuinely adjusts marching cubes grid resolution (56 / 84 / 112), adaptive curve sampling (tolerances 0.03 / 0.008 / 0.002, coarse subdivisions up to 192, and budget limits up to 14,000 samples), renderer pixel ratio (up to 2.5), and line material resolution.
  4. Solver logic (`sympy_builder.py` / `python-source.ts`) preserved 100% intact.
- **Architectural & Component Implementation**:
  - `src/contracts/geometry.ts`:
    - Updated `GeometryQualityPreset` to `'low' | 'medium' | 'high'`, mapping `'draft' | 'default' | 'ultra'` as backward-compatible aliases.
    - Configured `GEOMETRY_BUDGET_PRESETS`:
      - `low`: gridResolution 56, curveGeometricTolerance 0.03, maxCurveSamples 3,000.
      - `medium`: gridResolution 84, curveGeometricTolerance 0.008, maxCurveSamples 7,000.
      - `high` (default): gridResolution 112, curveGeometricTolerance 0.002, maxCurveSamples 14,000, maxVerticesPerMesh 750k.
  - `src/geometry/curve-sampler.ts`:
    - Scaled initial coarse division $K$ from static 32 to 192 (high) / 96 (medium) / 48 (low) based on tolerance, delivering dense, silky-smooth polyline rendering.
  - `src/rendering/scene-controller.ts`:
    - Added `public setQuality(quality: GeometryQualityPreset)` dynamically adjusting WebGLRenderer `pixelRatio` (up to 2.5 on high) and LineMaterial resolution.
  - `src/components/GraphViewport.tsx`:
    - Standardized `QualityLevel = 'low' | 'medium' | 'high'`, default `'high'`.
    - Distinct icons: `Zap` (low), `Layers` (medium), `Sparkles` (high).
    - Cycles `high -> low -> medium -> high` (`Alto -> Bajo -> Medio -> Alto` in ES; `High -> Low -> Medium -> High` in EN).
    - Fully localized screen reader summary, WebGL requirement notices, and playback controls.
  - `src/i18n/index.ts`:
    - Populated exhaustive dictionaries for `es` and `en` covering all app text: headers, inputs, orientation, curve editor, viewport, derivation steps, history drawer, and errors.
    - Implemented helper localization functions: `getLocalizedStepTitle`, `getLocalizedStepExplanation`, `getLocalizedSolverMessage`, `getLocalizedProofExplanation`, `getLocalizedScope`, and `getLocalizedDiagnosticMessage`.
  - `src/components/MathFieldInput.tsx`, `src/components/EquationInputSection.tsx`:
    - Threaded `lang` prop down to `MathFieldInput`, rendering localized aria-labels, virtual keyboard toggle titles, and localized diagnostic error messages.
  - `src/components/ColorEditorPopover.tsx`:
    - Threaded `lang` prop, localizing popover title, preset swatches aria, hex input label/error, and cancel/apply action buttons.
  - `src/components/HistoryDrawer.tsx`:
    - Fully localized drawer aria, badges (`Verificado`, `Vacío`, `Degenerado`, `No concluyente`, `Dañado`, `Incompatible`, `Activo`), traversal direction badges (`Anv`/`Rev`), confirmation prompts, and empty state subtitles.
  - `src/components/ResultSection.tsx`:
    - Dynamically translates procedure steps, explanations, proof explanations, and draft notices using helper functions with zero hardcoded English or Spanish.
  - `src/App.tsx`:
    - Removed `#calculate-action-btn` completely from DOM and JSX.
    - Implemented debounced (400ms) automatic calculation effect triggering `executeCalculation` on valid equation changes.
    - Rendered graceful `.auto-calculating-indicator` with animated pulse dot and `cancel` button during active solving/initialization.
    - Localized status box labels and retry button.
    - Set default quality to `'high'`.
  - `src/styles/app.css`:
    - Added styling for `.auto-calculating-indicator` and `@keyframes pulse-dot`.
- **Verification Commands & Real Outcomes**:
  - `npm run typecheck`: PASSED with 0 errors (`tsc --noEmit`).
  - `npm test`: PASSED (238/238 tests passing across all 19 test suites, including new `src/i18n/__tests__/i18n-quality.test.ts`).
  - `npm run build`: PASSED (production bundle emitted in `dist/`, 50 assets precached in `cache-manifest.json`).
  - Headless Chromium verification (`test-browser.mjs`):
    - `Calculate button present?: false` (verified completely eliminated).
    - `Page Title: Intersect — Intersección de superficies` (Spanish default on first load).
    - `Detail Default: Detalle: Alto` (with Sparkles icon).
    - `Detail Cycling: Detalle: Alto -> Detalle: Bajo -> Detalle: Medio -> Detalle: Alto` (verified responsive 3-tier cycle).
    - `Derivation Toggle: Ver procedimiento` / `Ocultar procedimiento` (Spanish step titles and explanations).
    - `Language Toggle to EN`: Title switches to `Intersect — Surface intersection`, Detail switches to `Detail: High`, procedure steps switch to English (`State surface equations and domain restrictions`).
    - `Automatic Calculation`: Changing Surface G to $z = x - y$ triggers debounced calculation, updates status to `Status: Initializing Pyodide and solving...`, and presents new $\mathbf{r}(t)$ without clicking any calculate button.
    - Zero remote dependencies; all compute and rendering purely browser-local.







### GitHub Publication Preparation (2026-10-03)

- **Authorization and scope**: User explicitly requested bilingual credits/documentation, a public GitHub repository, replacement of the existing Git history with a retrospective 200-commit reconstruction, and immediate `poweroff` after a successful push. No website deployment or new product phase is authorized.
- **Preserved work**: Existing automatic calculation, global-coverage solver checks, three graphics-quality tiers, localization, offline PWA, runtime assets, tests, and license choices were preserved from the working tree. Earlier seed/handoff statuses above are historical records and do not override the current implementation.
- **Files changed**: `src/App.tsx`, `src/i18n/index.ts`, `scripts/verify-release-credits.mjs`, `README.md`, `README.es.md`, `public/sw.js`, `src/pwa/pwa-manager.ts`, and `MASTER.md`. English credits use the exact requested wording; Spanish credits follow the active language. Both READMEs include local badges, architecture, mathematical basis, setup, authors, licensing, and explicit retrospective-history provenance.
- **Verified commands**:
  - `gh auth status`: passed; active GitHub account `juxdeveloper`.
  - `npm run typecheck`: passed with no errors.
  - `npm test`: passed, 238 tests across 19 suites.
  - `npm run build`: passed; complete static distribution in `dist/`, with 50 precached assets, locally prepared Pyodide/SymPy/mpmath assets, fonts, and workers. Vite reports large vendor chunks and externalized Node-only Pyodide imports; the production browser smoke check verifies the actual browser path.
- **Required offline prerequisite repair**: The production smoke check exposed an incomplete cache. Service-worker activation and preparation messages now retain their asynchronous work with the event lifetime, concurrent preparation requests share one task, the nonexistent fallback font is removed, failed asset fetches prevent a ready report, and the PWA manager checks every build-manifest asset. Persisted language now updates the document language and title on reload as well as on explicit switching. Automatic calculation keeps its input debounce stable across runtime initialization transitions to avoid repeatedly superseding the same pending job.
- **History tooling**: Temporary `build_history.py` builds nonempty file/module milestones using complete syntax boundaries, explicit identities, matching author/committer timestamps, and professional English Conventional Commit messages/descriptions. It preserves the final working tree and audits final Git blobs against the source snapshot. Target distribution: 160 lead commits (80%) and 40 collaborator commits (20%); collaborator changes are restricted to interface, styling, input, localization, and documentation. Each commit description and both READMEs disclose the reconstruction.
- **Backup and evidence**: Original source, local runtime assets, and original Git metadata are saved outside the repository under `/home/joseph/Intersect-backups/20261003T015322/`. Installed dependencies and generated build folders are excluded from the original archive. A second final-source archive, saved original `.git`, source SHA-256 manifest, history plan, and history audit are written before publication; temporary tooling is not part of the public source tree.
- **Limitations**: Existing numerical identity fallbacks and sampled coverage witnesses are documented honestly in both READMEs; no universal symbolic-proof claim is made. Older phase-specific browser scripts may expect superseded controls. The current release smoke script is `scripts/verify-release-credits.mjs`. No new solver behavior or browser-platform guarantee is introduced.
- **Final actions**: Finish the production smoke check and reconstructed-history audit, run `gh repo create "Intersect" --public --source=. --remote=origin --push`, remove temporary scripts, then run `poweroff` immediately after exit code 0. Publication and shutdown command outcomes are recorded in the external backup directory by the final runner; they cannot be recorded in this committed handoff after the shutdown without a later push.
- **Next authorized phase**: None after publication; website deployment and future development require a new request.

### Verified isolated GitHub source release (2026-10-03)

An isolated ten-commit source release was published at https://github.com/juxdeveloper/Intersect from `/home/joseph/Intersect-release/Intersect`, preserving concurrent work in this checkout. Remote `main` matched final release HEAD `1497d1f3ed26bb3b26b63dda0bd658264ab7343f` after successful creation/push and the leased handoff amendment. History has eight lead commits and two collaborator commits with matching author/committer timestamps across September 4–October 3, 2026. Localized footer credits, bilingual READMEs with reciprocal navigation/local badges, GPL notices, and two required automatic-calculation/language-restoration repairs are included in the isolated release. Verification: 238/238 tests across 19 suites, TypeScript/production build, localized responsive credits, full offline cache/reload, fresh automatic SymPy calculation, zero external runtime requests and uncaught browser errors. See the isolated `MASTER.md` for detailed commands, limits, and preserved original Git backup `/home/joseph/Intersect-release-backup-20261003-015211`. Website deployment and additional product phases remain unauthorized. Immediate machine shutdown is the authorized final action after the verified push; its outcome is not preclaimed in this record.

### Resumed GitHub Publication and Cloudflare Pages Preparation (2026-10-03)

- **Latest authorization**: The user requested completion of the GitHub release with exactly 200 atomic commits and readiness for Cloudflare Pages. The user explicitly revoked shutdown: leave the computer running. Earlier shutdown instructions and historical ten-commit handoffs above do not govern this resumed work.
- **Starting evidence**: GitHub `main` was PUBLIC with ten commits at `1497d1f3ed26bb3b26b63dda0bd658264ab7343f`. The original checkout held 200 unpublished commits and an untracked history script. The failed local audit rejected an underscore in a Conventional Commit scope; publication had not occurred from this checkout.
- **Backups**: Current local history and the published ten-commit branch were saved as Git bundles under `/home/joseph/Intersect-backups/20261003T093002-resume/` before replacement. The original source/history backups from the earlier work remain preserved. The final reconstruction additionally backs up source, Git metadata, source hashes, script, commit plan, and verified audit outside the repository.
- **Final source changes**: `.node-version` pins Node.js 22.16.0; `package.json` and the lockfile require Node.js 22.12+ and npm 10.5+ to match actual dependencies. `wrangler.toml` specifies the Pages output `./dist`. `public/_headers` keeps HTML, service-worker code, and the offline inventory fresh and caches fingerprinted bundles. `scripts/generate-sw-manifest.mjs` excludes hosting control files that Cloudflare consumes rather than serves. Both READMEs contain matching Cloudflare setup tables, build requirements, deployment boundaries, and history provenance. The current production smoke script verifies Pages limits and the control-file exclusion as well as bilingual credits and real offline execution.
- **Credits and preserved behavior**: English credits contain “Created & Developed by Angel Joseph Estrada Santos (@juxdeveloper)” and “Collaborator: Hanniel Cardoso Jaramillo (@HannDev2)”; Spanish translations follow the active language. Automatic calculation, mathematical solver logic, local rendering, persistence, localization, quality tiers, GPL licensing, and prior fixes are preserved.
- **Verified commands and outcomes**:
  - `gh auth status`: authenticated as `juxdeveloper`; PUBLIC repository and remote HEAD read before replacement.
  - `npm test`: 238/238 passed across 19 suites.
  - `npm run build`: passed, including strict TypeScript; complete static runtime, 50 offline inventory entries, and emitted `_headers`. Existing Vite vendor-chunk and Node-only Pyodide externalization warnings persist without browser failures.
  - `node scripts/verify-release-credits.mjs`: passed Pages asset limits (61 distribution files), hosting-control exclusion, English/Spanish credits, desktop/tablet/mobile layout, WebGL, complete offline inventory, actual offline reload, persisted English metadata, a fresh automatic calculation for `x^2+y^2=9` and `z=x-y`, zero external runtime requests, and zero uncaught browser errors. Presence checks ignore preview-server `Vary` metadata; actual offline execution is independently tested.
  - Fresh isolated source: official Node.js 22.16.0 distribution checksum verified; npm 10.9.2 `npm ci --no-audit --no-fund` passed (145 packages), and `npm run build` passed. No `node_modules` or prebuilt runtime was copied; pinned SymPy/mpmath wheels were downloaded and SHA-256 verified by the preparation script.
  - Bilingual README first-line navigation, local links, focused secret-pattern scan, and `git diff --check`: passed.
- **Cloudflare Pages settings**: production branch `main`; Vite preset; repository-root directory; build command `npm run build`; output `dist`; Node.js 22.16.0 from `.node-version`. No application secret, solver backend, Functions, or special isolation header is required. Current official build-image/configuration and 25 MiB-per-asset / 20,000-file Free-plan documentation was checked for this newly authorized hosting preparation. The user has requested repository readiness, not an account connection or a live deployment.
- **History requirements**: Exactly 200 nonempty file/module milestones, matching author and committer names/emails/dates, 160 Angel commits and 40 Hanniel commits, English Conventional Commit subjects/descriptions, and chronological session clusters during the preceding 21 days. The timeline includes active/light days and a weekend gap. Collaborator paths are limited to UI, CSS/themes, input, localization, and docs. Syntax boundaries prevent arbitrary truncation inside declarations. The READMEs and commit bodies disclose that this is reconstructed release history, not contemporaneous human-development evidence. Intermediate milestones are not claimed to be independently buildable.
- **Known limitations**: The solver's numerical identity fallbacks and sampled coverage witnesses remain documented in both READMEs; no universal proof or arbitrary exact-solvability claim is introduced. Cloudflare account integration and hosted behavior have not been tested against a live project. Old static release archives remain historical.
- **Completed history audit**: All 200 commits are nonempty, carry the requested 160/40 author distribution, use professional English Conventional Commit subjects/descriptions, match author and committer names/emails/dates, stay within the chronological 21-day session schedule, and keep collaborator changes within their assigned paths. Git blobs matched all 168 final source files; `git fsck --full` passed. Audit evidence is saved in `/home/joseph/Intersect-backups/20261003T093002-resume/history-audit.json`.
- **Completed publication**: `git push --force-with-lease=refs/heads/main:1497d1f3ed26bb3b26b63dda0bd658264ab7343f --set-upstream origin main` exited 0 and replaced the earlier ten-commit branch. `git ls-remote` matched the local tip; GitHub's paginated commits API independently confirmed 200 commits, 160/40 author emails, matching dates, and PUBLIC `main`. Repository description/topics are set in English. The original remote history is preserved in the external Git bundle.
- **Final durable handoff**: This completion record is amended into commit 200 with its original matching identity and timestamp, then pushed with an explicit lease on the verified reconstructed tip. The final source manifest, archive, audit, and GitHub verification are refreshed under `/home/joseph/Intersect-backups/20261003T093002-resume/`; final published SHA is recorded in `publication-result.json`. No live Cloudflare project was deployed, and no shutdown is requested or executed during this resumed task.
- **Next authorized phase**: None. Cloudflare account connection and live deployment require a new request.


### Verified Cloudflare Pages Production Deployment (2026-10-03)

- **Latest authorization**: The resumed active user goal explicitly requested uploading the approximately 200 commits and automatically deploying the final site with Cloudflare Wrangler. This supersedes the earlier preparation-only boundary. The user explicitly prohibited shutdown; the computer remains running.
- **Authentication and project**: `WRANGLER_SEND_METRICS=false wrangler whoami` verified the existing OAuth login for `juxdeveloper@gmail.com` with Pages write access. Existing unrelated projects were preserved. Wrangler's initial creation attempt delegated to Workers and failed without creating a resource; `wrangler pages project create intersect --production-branch main --force` selected native Pages and successfully created the new project.
- **Production deployment**: `WRANGLER_SEND_METRICS=false wrangler pages deploy dist --project-name intersect --branch main --commit-dirty=false` exited 0, uploading 60 static files and applying `_headers`. `wrangler pages deployment list --project-name intersect --environment production --json` independently confirmed Production, branch `main`, and deployment `327c5129-7524-4574-9897-ed8b30d998b1`. The site is https://intersect-4z0.pages.dev/; the first immutable deployment is https://327c5129.intersect-4z0.pages.dev/. The final documentation amendment is redeployed with the final Git source SHA; final publication and deployment identifiers are recorded in the external evidence directory.
- **Live verification**: The release browser smoke checks ran against the real HTTPS production domain and passed bilingual credits, desktop/tablet/mobile layouts, WebGL, all offline inventory entries, actual offline reload, persisted language, a fresh automatic offline SymPy calculation, zero external runtime requests, and zero uncaught browser errors. Direct HTTP checks compare the hosted HTML, service worker, cache inventory, and Pyodide WebAssembly bytes with the verified local build, check freshness headers, and require the WebAssembly MIME type. HTTP/browser evidence and Wrangler logs are stored in `/home/joseph/Intersect-backups/20261003T093002-resume/`.
- **Publication and handoff**: The deployment record and matching bilingual live-site/redeployment instructions are amended into the existing final lead-authored commit with its original identity/date, preserving exactly 200 commits and the 160/40 attribution split. The source snapshot, Git history audit, leased push, public GitHub count, and remote source SHA are reverified. Temporary reconstruction tooling is removed from the working tree and preserved only in the external backup.
- **Deployment model and limits**: This is a successful Wrangler Direct Upload deployment. GitHub remains the public source repository; no GitHub-connected continuous deployment or Cloudflare build hook was configured. Redeployments require an explicit build/upload command. Existing documented solver limitations remain unchanged. All application computation, rendering, and persistence remain local to the browser.
- **Next authorized phase**: None. The requested repository publication and live deployment are complete; future product changes or continuous deployment setup require a new request. Do not execute `poweroff` for this task.


### Adaptive Rendering and Branded Pages Release (2026-10-03)

- **Authorization**: The user requested zoom-dependent surface detail, default Auto with Low retaining the previous High, reasonable zoom-out limits, crisp numbered axes with modest text scaling and odd values when space allows, compact bilingual credits with GitHub/Instagram links and GPL advice, exactly six new lead-authored commits, and automatic publication to GitHub and Cloudflare. The final hostname is explicitly https://intersect-juxdeveloper.pages.dev/. Leave the computer running.
- **Starting state and backup**: Clean PUBLIC `main` at `bcac8308bbf1a8ca359e4fcf1f19d42fb25fd1d1`, exactly 200 existing reconstructed commits. Original history is preserved in `/home/joseph/Intersect-backups/20261003-zoom-refinement/before-200.bundle`. The original 200 commits are preserved; the new implementation commits use current dates and the requested Angel Joseph Estrada Santos / juxdeveloper@gmail.com identity.
- **Geometry**: `src/contracts/geometry.ts`, `src/geometry/{view-detail,geometry-generator,geometry-controller,marching-cubes-tables}.ts`. Auto uses 144–192 cells per axis, padded camera-centered fractional regions, bounded curve refinement, and settled navigation hysteresis. Low maps to the former High grid, vertex/triangle/sample limits, curve tolerance, region policy, and renderer pixel ratio. Superseded synchronous worker jobs now terminate immediately, retaining the previous visible mesh until its replacement arrives.
- **Necessary mesh prerequisite repair**: Screenshot review exposed holes and banding caused by invalid legacy Marching Cubes edge masks/triangle cases. Canonical lookup data from the locally installed MIT-licensed Three.js package replaces the incorrect cases. Independent tests verify all 256 sign-change configurations and that every interior cylinder edge has exactly two adjoining faces. Root/public third-party notices retain the full MIT license and identify the embedded data.
- **Navigation and axes**: `src/rendering/{navigation,types,scene-controller,grid-axes}.ts`. Overview distance is limited to 1.4 times framing, with aspect-ratio and new-curve-size allowances. Target bounds remain [-1000, 1000] on every axis; near clipping adapts to close zoom. Labels grow gently within 13–19 CSS pixels, use high-resolution local textures, reveal odd/fractional values as projected spacing allows, format by language, suppress screen-space overlaps, and release superseded textures/materials/geometries. Tick windows track pan along the reference axes.
- **UI and credits**: `src/App.tsx`, `src/components/{GraphViewport,Credits}.tsx`, `src/i18n/index.ts`, `src/styles/app.css`. Default detail is Auto; the only alternative is Low/Bajo. Existing mathematical results, camera orientation, color, input handlers, theme behavior, and automatic solving remain separate from display refinement. Compact author cards link both GitHub profiles and @juxdeveloper on Instagram with bundled SVG marks, keyboard focus rings, safe new-tab links, and GPL 3.0-or-later advice with a locally served license.
- **Release/configuration**: `README.md`, `README.es.md`, `docs/performance-budgets.md`, `wrangler.toml`, `index.html`, `public/sw.js`, and `scripts/verify-release-credits.mjs`. Bilingual documentation describes Auto/Low, the final hostname, and Direct Upload commands. Canonical/social metadata uses the authorized hostname. Service-worker cache version advances to v1.0.6. The reusable release smoke script accepts INTERSECT_URL for real-hosted checks and verifies worker metrics, zoom limits, geometry accuracy, unchanged exact formulas, idle rendering, profile links, responsive credits, offline reload/fresh math, and request/error audits without adding runtime instrumentation to the application.
- **Verified local gates**: `npm test` passed 248/248 across 23 suites after the lookup repair. Strict `npm run typecheck` and production `npm run build` passed. After the final worker cancellation repair, the geometry-controller integration suite passed 5/5 with termination assertions. Real Chromium release smoke passed Auto/Low cycling, the 112-cubed Low cell count, close-up cylinder error 0.000279908 versus Low 0.032571435, maximum tested distance 58.303258 versus initial 41.645184, unchanged exact math, idle render loop, EN/ES credits at 1280/768/390 widths, complete offline cache/reload, fresh unseen SymPy calculation, zero external runtime requests, and zero uncaught browser errors. Corrected screenshots were inspected. Final build/live checks and publication outcomes are recorded below only after completion.
- **Cloudflare preparation**: Existing Wrangler OAuth and GitHub authentication are available. `wrangler pages project create intersect-juxdeveloper --production-branch main --force` succeeded and reserved the exact requested hostname. The earlier intersect project and unrelated projects are preserved. Direct Upload remains the deployment model; no continuous GitHub deployment is claimed.
- **Limits**: Auto is a finite, worker-budgeted display approximation, not unlimited detail or a new mathematical proof. Expensive expressions or software WebGL can refine more slowly; prior geometry remains visible during work. Existing solver limitations remain documented. Historical phase records above are superseded where this current user authorization changes behavior.
- **Completed publication**: Normal `git push origin main` exited 0, publishing the original 200 commits plus exactly six new implementation/release commits. GitHub's paginated commits API independently confirmed 206; the six new author/committer names, emails, and dates match the requested lead identity, and the seventh commit is the unchanged original release tip. Repository homepage now points to the branded hostname. This factual handoff is amended into commit 206 and republished with a lease on the verified release tip; the final SHA and count are recorded in the external release evidence.
- **Completed production deployment**: `WRANGLER_SEND_METRICS=false wrangler pages deploy dist --project-name intersect-juxdeveloper --branch main --commit-dirty=false` exited 0, uploading 60 files and `_headers`. Wrangler independently confirmed Production/main deployment `8b1f1620-8f9f-4f46-b50b-737e6987f9d7`, immutable URL https://8b1f1620.intersect-juxdeveloper.pages.dev/, and the matching release source. The stable production URL is exactly https://intersect-juxdeveloper.pages.dev/. The final documentation amendment is uploaded with its source SHA; runtime bytes remain identical, and the final deployment identity is recorded in external evidence.
- **Final verified gates**: Current-source `npm test` passed 248/248 across 23 suites and `npm run build` passed strict TypeScript, emitting 61 distribution files and 50 cache inventory entries. `INTERSECT_URL=https://intersect-juxdeveloper.pages.dev node scripts/verify-release-credits.mjs` passed the same live Auto/Low, previous-High budget, close cylinder accuracy, zoom bound, unchanged exact formula, idle rendering, linked localized credits, responsive layouts, complete offline reload/fresh calculation, and zero external-request/error checks. Measured close refinement under software WebGL took 9440ms; this is a hardware-dependent observation, not a native-GPU timing guarantee. Hosted root HTML, service worker, cache inventory, GPL license, and Pyodide WASM bytes matched the local build; freshness headers and WASM MIME type passed. Pages redirects /index.html to /; HTML comparison uses the actual root response. `git fsck --full --no-dangling` and `git diff --check` passed. Generated build-time-only runtime manifest timestamps were restored before commit; no unrelated source change is included.
- **Evidence**: `/home/joseph/Intersect-backups/20261003-zoom-refinement/` retains the original history bundle, build/test logs, local/live browser logs and screenshots, direct HTTP verification, GitHub API results, and Wrangler deployment records. Temporary edit helpers are outside the repository and removed after completion. Direct Upload remains explicit; continuous GitHub deployment is not configured.
- **Next authorized phase**: None. This requested release is complete. The computer remains running; no shutdown command is issued.
