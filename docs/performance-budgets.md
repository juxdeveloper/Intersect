# Intersect — Phase V11 Performance & Accessibility Budgets

Document revision: 1
Date: 2026-10-02
Environment: Linux x86_64, Node v26.10.0, Headless Chromium (/opt/google/chrome/chrome) with SwiftShader (software WebGL 2.0 Angle), Vite production preview.

## 1. Baseline Measurements Summary

Measurements captured on clean production bundle prior to V11 tuning (`docs/baseline-benchmark.json`):

| Metric / Workload | Baseline Value | Analysis / Bottleneck |
| :--- | :--- | :--- |
| **Main JS Bundle Size** | 5,160.09 KB (gzip: 1,458 KB) | Monolithic chunk containing React, MathLive, ComputeEngine, and Three.js bundled together. |
| **Geometry Worker Chunk** | 3,414.07 KB | Inadvertently bundled `@cortex-js/compute-engine` via `import { parseCurveExpression }` in `curve-sampler.ts`. |
| **Initial Shell Load Time** | 3,042 ms | Dominated by parsing and executing 5.16 MB monolithic JS bundle. |
| **Initial Main JS Heap** | 17.78 MB (Total: 29.7 MB) | Heavy initial footprint prior to user interaction. |
| **Cold Calculation (W2)** | 12,182 ms | Cold initialization of Pyodide, Python stdlib zip, mpmath, and SymPy wheel (17.55 MB local assets). |
| **Warm Calculation (W3)** | 410 ms (quadratic), 55 ms (trig) | Fast symbolic execution once Pyodide/SymPy is resident in worker. |
| **Cancellation & Recovery (W4)** | 159 ms | Clean preemption and fast subsequent execution. |
| **Animation Frame Time (W5)** | Avg: 49.81 ms, Max: 66.7 ms | Software SwiftShader CPU WebGL rendering; target is <= 16.7 ms on hardware GPU, <= 66.7 ms on software SwiftShader. |
| **Idle Rendering (W5)** | 31 rAF calls in 500 ms (62 Hz) | **Bottleneck**: Scene animation loop does not sleep when animation completes and controls are stationary. Consumes CPU continuously during idle. |
| **History Opening (W7)** | 115 ms | Responsive local IndexedDB read. |
| **Heap Stability (W8)** | +0.85 MB delta over 4 cycles | Bounded memory; no runaway leak observed. |

---

## 2. Established Acceptance Budgets

Based on repository facts and the tested environment, the following budgets are established for Phase V11:

### A. Loading & Bundle Architecture
1. **Geometry Worker Chunk Size**: $\le 120\text{ KB}$ (reduced from 3,414 KB by decoupling ComputeEngine and passing pre-parsed AST or lightweight evaluation).
2. **Main Bundle Splitting**: Code-split Three.js and vendor libraries using Vite `rollupOptions.output.manualChunks` so initial shell parsing is under 2.5 MB.
3. **Initial Shell Interactivity**: Interactive shell (with responsive math fields and buttons) ready in $\le 2,500\text{ ms}$ on baseline profile.
4. **Zero Remote Runtime Requests**: 0 HTTP requests to external origins, 0 CDNs, 0 telemetry.

### B. Worker & Computation Budgets
1. **UI Thread Offloading**: 0 heavy mathematical solving or 3D meshing on the UI thread (100% offloaded to dedicated Web Workers).
2. **Warm Solve Duration**: $\le 1,000\text{ ms}$ for standard quadrics and polynomials on baseline hardware.
3. **Worker Cancellation Responsiveness**: Cancel acknowledged and unblocked in $\le 500\text{ ms}$; subsequent request accepted cleanly.
4. **Single Active Job Policy**: Stale jobs immediately superseded; no accumulating workers or promises.

### C. Geometry & Rendering Budgets
1. **Idle Render Loop Shutdown**: $\mathbf{0}\text{ rAF frames}$ once animation playback has completed and camera controls have settled (zero idle CPU/GPU consumption).
2. **Device Pixel Ratio**: Capped at $2.0$ on high-DPI screens to prevent excessive fill-rate and memory pressure.
3. **Hardware Rendering Target**: $\le 16.7\text{ ms}$ (60 FPS) on discrete/integrated GPU profiles; $\le 66.7\text{ ms}$ (15 FPS minimum) under CPU software SwiftShader emulation.
4. **Adaptive Quality Presets**:
   - `draft`: 40 grid resolution, $\le 100\text{k}$ vertices, $\le 200\text{k}$ triangles.
   - `default`: 64 grid resolution, $\le 250\text{k}$ vertices, $\le 500\text{k}$ triangles.
   - Reference-scale visibility: surfaces remain visible without clipping or disappearing at reduced detail.

### D. Memory & Lifecycle Budgets
1. **Heap Growth Plateau**: $\le 10\text{ MB}$ net drift across repeated calculation and modification cycles.
2. **GPU Resource Disposal**: Superseded Three.js geometries, line geometries, and materials explicitly disposed upon replacement or component unmount.
3. **History Storage Limit**: Max 100 records and $\le 512\text{ KB}$ per record budget, enforced via atomic FIFO pruning.

### E. Accessibility (WCAG 2.1 AA Engineering Targets)
1. **Focus & Keyboard Operability**: 100% of interactive controls accessible via physical keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Esc`, arrow keys).
2. **Direction Control**: Announced as a single semantic radiogroup with arrow-key switching and `aria-checked` states.
3. **Color & Math Overlays**: Dialog focus trapping, Escape dismiss, and focus restoration to trigger elements.
4. **Prefers-Reduced-Motion**: Respects system motion preference by disabling auto-tracing and displaying static direction indicator.
5. **Screen Reader Announcements**: Polite aria-live regions for calculation completion and validation diagnostics without interrupting user typing.
6. **Color Contrast & Labels**: All primary text $\ge 4.5:1$ contrast ratio against background; outcomes identified by descriptive text and badges, not color alone.
