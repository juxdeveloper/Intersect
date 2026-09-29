# Intersect — Architecture & Data Contracts (V1)

This document details the architectural boundaries, serialization formats, and contract rationale established in Phase V1.

## 1. System Subsystems and Ownership

```
[ MathLive / Text Inputs ]
           │
           ▼ (V2 Structured AST Bridge)
[ Calculation Request Contract ] ──(Structured Clone)──► [ Pyodide / SymPy Worker (V3/V4) ]
           │                                                      │
           │                                                      ▼
           │                                           [ Calculation Result ]
           │                                           (Exact Curve & Proof)
           │                                                      │
           ├──────────────────────────────────────────────────────┘
           ▼
[ Adaptive Implicit Meshing & Curve Sampler (V6) ]
           │
           ▼ (Transferable Arrays)
[ Three.js WebGL / WebGPU Scene (V7) ]
           │
           ▼
[ IndexedDB Versioned Persistence (V10) ]
```

### Subsystem Boundaries:
1. **User Interface (React + Custom CSS)**:
   - Manages user input state, responsive layout, visual dark minimal theme, and coordination.
   - Does NOT perform heavy algebraic solving or numerical surface meshing on the main thread.
2. **Symbolic Engine (Web Worker + Pyodide / SymPy)**:
   - Runs in an isolated background thread.
   - Communicates exclusively via JSON-serializable `WorkerRequest` and `WorkerResponse` messages.
   - Evaluates structured expression trees, never arbitrary user string execution via `eval()`.
3. **Geometry Generator (Worker / WebAssembly)**:
   - Generates approximate triangle meshes for implicit surfaces and piecewise curve vertex arrays for 3D display.
   - **Crucial Rule**: Sampled geometry NEVER upgrades or substitutes for exact mathematical proof.
4. **3D Visualizer (Three.js)**:
   - Visualizes surfaces and curve.
   - Operates in right-handed coordinates with **+Z oriented UP**.
   - Bounded navigation within `[-1000, 1000]^3`; initial reference framing in `[-50, 50]^3`.
5. **Persistence (IndexedDB)**:
   - Client-side storage of calculation history, inputs, exact outputs, and curve color.
   - Versioned schema to allow smooth forward migrations.

---

## 2. Shared Contracts Detail

### A. Calculation Request (`src/contracts/calculation.ts`)
- `jobId`: String identifier uniquely identifying each calculation run.
- `contractVersion`: Schema version (`"1.0.0"`).
- `surfaceF` & `surfaceG`: `EquationInput` containing `rawInput`, format (`latex` or `ascii`), and optional structured AST.
- `direction`: `'forward' | 'reverse'`.
- `bounds`: `WorldBounds` defining `[-1000, 1000]^3` calculation limit.

### B. Parameter Domain & Serialization (`src/contracts/domain.ts`)
- **JSON Serialization Invariant**: Standard JSON specifications convert JavaScript `Infinity` and `NaN` to `null`. To preserve exact mathematical infinite endpoints without data loss, endpoints are represented as:
  ```typescript
  type EndpointValue =
    | { kind: 'finite'; exact: string; numericApprox?: number }
    | { kind: 'infinite'; sign: '+' | '-' };
  ```
- **Intervals**: Support open and closed endpoints (`minInclusive`, `maxInclusive`).
- **Mathematical Domain vs Viewport Clipping**:
  - The parameter domain is the intrinsic set of real numbers where $r(t)$ exists and satisfies both surface equations identically.
  - Viewport bounds truncate only the visual 3D rendering; they never truncate or redefine the mathematical domain.

### C. Result States & Mathematical Honesty (`src/contracts/results.ts`)
The result is modeled as an exhaustive discriminated union keyed on `status`:
- `verified-curve`: Contains exact $x(t), y(t), z(t)$, valid domain, traversal direction, derivation steps, and an algebraic verification record.
- `empty-bounded`: Proved no intersection points exist within the bounded calculation cube.
- `inconclusive`: Search exhausted or solver unable to determine existence.
- `unsupported`: Equations contain operations or degrees outside solver capability.
- `invalid-input`: Malformed equation syntax or contradictory bounds.
- `degenerate`: Intersection is an isolated point, coincident surfaces (2D region), or empty algebraic set.
- `cancelled`: Job cancelled by user or superseded by new input.
- `runtime-failure`: Worker crash or resource limit exceeded.

**Integrity Rule**: An uncertain result or degenerate geometry can never masquerade as a verified curve.

### D. Worker Protocol & Concurrency (`src/contracts/worker.ts`)
- All messages use structured JSON envelopes.
- **Stale Job Rejection**: The UI maintains `activeJobId`. Any response matching a prior or superseded job ID is rejected immediately (`isFreshWorkerMessage`).

---

## 3. Static Hosting & Local Asset Policy

- **Zero Remote Dependencies**: The application runtime makes NO requests to CDNs, external font hosts, remote APIs, or cloud solvers.
- **Base-Path Agnostic**: Assets are emitted with relative paths (`base: './'`), allowing the static build to run seamlessly from any web root or nested subpath.

---

## 4. Phase V2 Mathematical Pipeline & SymPy Bridge (`src/math/`)

Phase V2 establishes the input parsing, semantic validation, domain collection, and conversion pipeline:

```
[ Raw User String (LaTeX / ASCII) ]
          │
          ▼  checkInputSize (length <= 500 chars)
[ MathLive Compute Engine ] ──(form: 'raw', parseNumbers: 'rational')──► [ MathJSON AST ]
          │
          ▼  Lossless conversion (no premature canonical evaluation)
[ Project ExpressionNode AST ]
          │
          ├─────────────────────────────────────────────┐
          ▼                                             ▼
[ Semantic Validator ]                        [ Domain Obligation Collector ]
- Single '=' per surface                      - Nonzero denominators (den != 0)
- Standalone expr -> expr = 0                 - Nonnegative radicands (rad >= 0)
- Surface variables: x, y, z                  - Strictly positive logarithms (arg > 0)
- Constants: pi, e                            - Trig & inverse trig domain restrictions
- Rejects chained '=' (x = y = z)             - Retained across algebraic simplifications
- Rejects inequalities (<, <=, >, >=)
- Rejects reserved 't' & unknown symbols
- Classifies: standard, identity, contradiction
          │                                             │
          └──────────────────────┬──────────────────────┘
                                 ▼
                   [ Safe SymPy Construction Plan ]
                   - Typed allowlisted builder tree
                   - Zero eval() / exec() / code generation
                   - Ready for V3 Pyodide worker runtime
```

### Key V2 Guarantees:
1. **Lossless Numeric Precision**:
   - Integers and finite decimals are converted directly to string-backed exact rationals `{ num, den }` via arbitrary-precision BigInt arithmetic, preventing IEEE 754 float drift.
   - Symbolic constants (`\pi`, `e`) are preserved symbolically.
2. **Domain Preservation**:
   - Denominator restrictions (e.g. `x/x` retaining `x != 0`, `(x^2 - 1)/(x - 1)` retaining `x - 1 != 0`) and root radicands (`\sqrt{x}` retaining `x >= 0`) are explicitly captured as symbolic domain obligations before algebraic manipulation.
3. **Safe SymPy Bridge for Phase V3**:
   - The output of V2 is a typed JSON data structure `SymPyConstructionPlan` declaring operators (`Integer`, `Rational`, `Symbol`, `Constant`, `Add`, `Mul`, `Pow`, `Sin`, `Cos`, etc.).
   - Phase V3's Python worker will instantiate SymPy expressions through an allowlisted dispatch map without string parsing or arbitrary Python execution.

---

## 5. Phase V3 Local Pyodide/SymPy Worker Runtime (`src/runtime/`)

Phase V3 establishes the offline, sandboxed Web Worker computation engine executing Pyodide 0.27.8 and SymPy 1.13.3 entirely inside the user's browser.

```
[ Main Thread: SymPyRuntimeController ]
          │
          │ PostMessage (InitWorkerRequest / PrepareExpressionsRequest)
          ▼
[ Dedicated Web Worker: sympy.worker.ts ]
          │
          ├─► 1. Load local Pyodide (pyodide.asm.js / wasm / stdlib) from public/pyodide/
          ├─► 2. Override CDN URL to local base path (_api.setCdnUrl)
          ├─► 3. Load local wheels (mpmath-1.3.0.whl, sympy-1.13.3.whl)
          └─► 4. Run application-owned sympy_builder.py module
                     │
                     ▼
       [ Allowlisted AST Dispatch ]
       - Integer, Rational, Symbol, Constant, Add, Mul, Pow, etc.
       - Real root semantics: odd roots of negative bases via real_root(b, q)**p
       - Explicit domain conditions preserved (x/x = 1 retains x != 0)
       - Zero user eval() / exec()
       - Destroys PyProxy objects; returns JSON serializable summary
```

### Key V3 Guarantees:
1. **Zero External Requests**:
   - Pyodide, Python stdlib, Mpmath wheel, and SymPy wheel are vendored into `public/pyodide/` (17.55 MB total distribution).
   - Asset integrity verified against SHA-256 manifest in `manifest.json`.
   - Local Pyodide loader overrides default CDN package lookups to ensure operation in offline environments and nested subpaths.
2. **Real-Valued Mathematical Semantics**:
   - Standard SymPy evaluates fractional powers on the principal complex branch (e.g. `(-8)**(1/3)` yields `1 + \sqrt{3}i`).
   - The builder detects odd rational denominators and constructs real roots via `sympy.real_root(base, q)**p` to yield `-2`, maintaining consistency with real 3D geometry.
3. **Domain Condition Tracking**:
   - Residual equations $E(x,y,z) = \text{LHS} - \text{RHS} = 0$ are simplified algebraically, while domain obligations (denominators $\neq 0$, radicands $\ge 0$, logs $> 0$) are maintained as explicit restrictions so that singularity conditions are never lost.
4. **Preemptive Cancellation & Single-Job Policy**:
   - A single active computation policy rejects or cancels superseded requests.
   - Cancellation issues a soft cancellation message followed by a 300ms grace timer. If the worker is blocked in synchronous Python computation, the controller calls `worker.terminate()` and spawns a fresh worker generation (`workerGeneration`).
   - Generational tagging prevents late messages from terminated workers from updating application state.

---

## 4. Geometry Subsystem & Worker Architecture (Phase V6)

```
[ Application / V7 Renderer ]
           │
           │ GeometryRequest (JobId, Generation, ASTs, Curve, Bounds, Region, Quality)
           ▼
[ GeometryController (Main Thread) ]
           │
           │ postMessage (Transferable ArrayBuffers)
           ▼
[ Dedicated Web Worker: geometry.worker.ts ]
           │
           ├─► 1. Numerical Evaluator (evaluator.ts)
           │      - Direct AST & closure compilation without eval()/Function()
           │      - Real odd roots: (-8)^(1/3) = -2
           │      - Domain obligation enforcement (denominator != 0, radicand >= 0)
           │      - Repeated-factor safe reduction: base^(2k) = 0 -> base = 0
           │
           ├─► 2. Marching Cubes Surface Extractor (marching-cubes.ts)
           │      - Streaming Z-slice evaluation (RAM < 100 KB)
           │      - 256-case table with exact-zero root interpolation
           │      - Mid-edge pole rejection for asymptotic jumps (1/x = 0)
           │      - Central difference normals with geometric face fallback
           │
           ├─► 3. Adaptive Curve Sampler (curve-sampler.ts)
           │      - Multi-point chord deviation testing (t_mid, t_1/3, t_2/3)
           │      - 3D Liang-Barsky box clipping with parameter refinement
           │      - Segment breaks for domain gaps & excluded points
           │      - [-100, 100] finite window for unbounded parameters
           │
           ▼
[ Transferable Typed ArrayBuffers ]
Mesh F: Float32Array positions, Float32Array normals, Uint32Array indices
Mesh G: Float32Array positions, Float32Array normals, Uint32Array indices
Curve:  Float32Array positions, Float64Array tValues, Uint32Array segmentBreaks
           │
           ▼ (Transferred to main thread; worker relinquishes buffer ownership)
[ V7 Scene & BufferGeometry Integration ]
```

### Buffer Ownership & Transfer Semantics:
1. **Transferable Objects**:
   - The geometry worker creates typed arrays (`Float32Array`, `Uint32Array`, `Float64Array`) and transfers their underlying `ArrayBuffer` instances in the `postMessage` transfer list.
   - After transfer, the worker's references become detached (0-byte length). The main thread / `GeometryController` assumes sole buffer ownership.
   - No Three.js objects or closures are created or sent across the worker boundary.
2. **Quality Presets & Budgets**:
   - `draft`: Grid $25^3$, max $15,000$ vertices, curve depth 6, tolerance $0.1$.
   - `default`: Grid $40^3$, max $50,000$ vertices, curve depth 8, tolerance $0.02$.
   - `high`: Grid $65^3$, max $120,000$ vertices, curve depth 10, tolerance $0.005$.
   - `ultra`: Grid $100^3$, max $300,000$ vertices, curve depth 12, tolerance $0.001$.
3. **V7 Integration Contract**:
   - V7 consumes `result.surfaceF`, `result.surfaceG`, and `result.curve`.
   - Mesh buffers plug directly into Three.js `BufferGeometry`:
     - `setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))`
     - `setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))`
     - `setIndex(new THREE.BufferAttribute(mesh.indices, 1))`
   - Curve buffers plug into `Line2` / `LineGeometry`:
     - `setPositions(segmentPositions)`
     - Segment breaks partition drawing calls across disjoint intervals without rendering artificial connector bridges.

---

## 7. Phase V7 Interactive 3D Rendering Engine (`src/rendering/`)

Phase V7 integrates Three.js into an interactive, high-performance, strictly local 3D viewport.

```
[ GeometryResult Buffers (from V6 Worker) ]
                   │
                   ▼
       [ ThreeSceneController ]
  ┌────────────────┼────────────────┐
  ▼                ▼                ▼
[ Surface F ]    [ Surface G ]    [ Intersection Curve ]
MeshStandardMat  MeshStandardMat  Line2 + LineMaterial
Color: #5b8ec7   Color: #8f94a0   Color: #f5eedb (warm off-white)
Translucent      Translucent      Screen-space linewidth 3.5px
DoubleSide       DoubleSide       depthTest: true, depthWrite: false
depthWrite:false depthWrite:false renderOrder: 10 (crisp on top)
  │                │                │
  └────────────────┼────────────────┘
                   ▼
          [ Scene Hierarchy ]
  - Coordinate frame: XY Ground grid at z=0, +X, +Y, +Z labeled axes
  - Bounded Navigation: Clamped target [-1000, 1000]³, camera-target offset preserved
  - OrbitControls: Drag orbit, wheel zoom, touch rotate/pan/pinch
  - Render On-Demand: Animation loop runs only during damping/interaction, 0% idle CPU
  - Lifecycle: ResizeObserver, context loss/restore, full resource disposal
```

### Key V7 Architectural Guarantees:
1. **Z-up Right-Handed Coordinate System**:
   - `camera.up.set(0, 0, 1)` set prior to OrbitControls initialization.
   - Initial perspective camera positioned along oblique vector $(1.15, -1.35, 0.95)$ framing the $[-50, 50]^3$ reference box comfortably regardless of container aspect ratio.
   - Reset View restores the exact initial origin-centered framing.
2. **Transparency Sorting & Depth Invariants**:
   - Translucent meshes use `transparent: true`, `opacity: ~0.4`, and `depthWrite: false` with `side: THREE.DoubleSide`. This completely eliminates triangular sorting clipping artifacts between intersecting surfaces.
   - Active curve is drawn with `Line2` (from Three.js lines addon) with screen-space pixel width `3.5px`, `depthTest: true`, and `renderOrder: 10` so it is always crisp and visible through surfaces.
3. **Disconnected Segment Preservation**:
   - Multi-segment curves (separated intervals or poles) extract independent `Line2` draw objects per segment. Disjoint gaps and singularities are never bridged.
4. **Bounded Navigation & Debounced Region API**:
   - Target is clamped to calculation bounds $[-1000, 1000]^3$ in the update loop, shifting camera position by the same $\Delta T$ to eliminate jumps.
   - When navigation settles significantly away from current render region, a debounced region change request is emitted to trigger progressive geometry extraction.
5. **Zero Idle CPU & Pure Local Bundling**:
   - Loop automatically sleeps when controls settle (`camDeltaSq < 1e-5`).
   - Capped pixel ratio `Math.min(window.devicePixelRatio || 1, 2)`.
   - 100% bundled locally with 0 external network requests.

---

## 8. Phase V9 Curve Animation & Appearance Architecture (`src/rendering/`, `src/contracts/appearance.ts`)

Phase V9 integrates progressive curve traversal tracing, a moving direction arrow, replay/pause controls, and a custom curve-color editor.

```
[ Active Verified Curve & Geometry ]
                │
                ▼
       [ CurveAnimator ]
  ┌─────────────┼─────────────┐
  ▼             ▼             ▼
[ Pacing ]  [ Reveal ]   [ Direction Arrow ]
Spatial     Segment-by-  Cone mesh (apex at head)
Arc-Length  segment via  Oriented along local tangent
Pacing      Line2        Dynamic screen-space scaling
(2.6s)      instanceCount Depth-tested, renderOrder: 15
            + Lead Line  Static cue preserved at finish
```

### Key V9 Architectural Guarantees:
1. **Explicit Animation Lifecycle**:
   - States: `'unavailable' | 'ready' | 'playing' | 'paused' | 'finished'`.
   - On new calculation or direction change, curve traces automatically once unless `prefers-reduced-motion: reduce` is active.
   - At completion, the full curve remains displayed with a static direction cue arrow; no continuous looping.
   - Playback button reflects state (`Pause` while playing, `Resume` when paused, `Replay` when finished).
   - Visibility change pauses elapsed time accumulation when the tab is hidden, preventing jarring progress jumps.
2. **Path & Gap Invariants**:
   - Progressive reveal operates across drawable segments using spatial arc-length pacing (`totalArcLength`).
   - Line segments before the active head use `line.geometry.instanceCount = k`.
   - Continuous sub-segment position is drawn cleanly by a small dedicated `leadLine` without per-frame geometry reallocation.
   - Gaps, poles, and disconnected intervals are never bridged: `leadLine` is hidden and the arrow transitions seamlessly to the start of the next segment in traversal order.
3. **Direction Arrow Mechanics**:
   - Positioned at interpolated 3D head position with cone apex oriented along the normalized local segment tangent.
   - Tangent frames handle stationary points, duplicate samples, and cusps safely without NaN rotations.
   - Dynamically scaled proportional to camera distance so it remains clear and readable without obscuring small curves.
   - Inherits active curve color and matches scene lighting.
4. **Custom Color Editor & Palette Architecture**:
   - Active curve swatch next to "Your curve" label provides single-click selection and double-click editor access.
   - Explicit Edit icon button provides accessible mouse, touch, and keyboard trigger (`aria-label`, `aria-expanded`).
   - Popover dialog (`role="dialog"`, `aria-modal="true"`) includes curated 8-color palette swatches and editable `#RRGGBB` hex field.
   - Changes live preview immediately on 3D curve, direction arrow, swatch button, and legend marker. Fixed translucent Surface F and G colors are never altered.
   - Clear commit/cancel semantics: Apply or outside-click commits; Cancel or Escape cancels and reverts to initial color.
   - Focus is trapped within modal popover and restored to the trigger element on close.
   - Deterministic color allocator (`getNextDefaultCurveColor`) assigns distinct, high-contrast colors from `CURVE_PALETTE` across sequential calculations.
5. **Appearance Serialization Contract (`CurveAppearance`)**:
   - Normalized opaque `#rrggbb` hex string is exposed in `CurveAppearance` interface, prepared for Phase V10 IndexedDB persistence.



