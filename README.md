[English](README.md) | [Español](README.es.md)

# Intersect

[![License: GPL-3.0-or-later](docs/badges/license.svg)](LICENSE)
![Release: 1.0.0](docs/badges/release.svg)
![Runtime: browser local](docs/badges/architecture.svg)

Intersect is an educational application for exploring the intersection of two real surfaces in three dimensions. Enter equations in **x, y, z** to see the surfaces, an exact-form parameterization when supported, its real parameter domain, and an educational derivation.

All calculation, rendering, and history storage run locally in your browser. The static distribution contains its JavaScript, fonts, Python runtime, and symbolic packages; it uses no hosted solver, CDN, analytics, or remote application API. Initial loading downloads assets from the site's own origin. Once offline preparation finishes, the installed PWA can reload and calculate without a network connection.

## Features

- Free-form equations through MathLive, with physical and touch mathematical keyboards.
- Live surface previews and automatic intersection calculation after a 400 ms typing pause.
- SymPy running in a dedicated Pyodide WebAssembly worker, with cancellation and recovery.
- An active curve formula, real parameter domain, and initially collapsed derivation.
- Forward/reverse traversal, curve animation, replay, and custom curve colors.
- Interactive Three.js scene with **+Z up**, colored axes, numbered ticks, translucent surfaces, and mouse/touch orbit, pan, and zoom.
- Low, Medium, and High graphics detail; High is the default.
- Spanish by default, an English switch, and persistent Auto/Light/Dark themes.
- Local IndexedDB calculation history, up to 100 entries, with a memory fallback when storage is unavailable.
- Responsive layout, keyboard controls, reduced-motion support, and offline PWA installation in supporting browsers.

## Architecture

React and TypeScript coordinate input, results, preferences, and history. MathLive and the Compute Engine convert mathematical input into validated expression trees. An allowlisted bridge sends structured expressions to SymPy in a dedicated Pyodide worker; user input is never evaluated as source code. A separate geometry worker meshes implicit surfaces and samples parameterized curves, while Three.js renders the scene through an on-demand loop. IndexedDB stores versioned calculation records, and a service worker caches the complete static runtime for offline use.

The main boundaries are `src/contracts/`, `src/math/`, `src/runtime/`, `src/geometry/`, `src/rendering/`, `src/persistence/`, and `src/components/`. All assets are bundled locally; the browser does not need a computation server.

## Mathematical principles and limits

The intersection satisfies both residual equations:

$$F(x,y,z)=0,\qquad G(x,y,z)=0.$$

A candidate parameterization is a vector function

$$\mathbf{r}(t)=(x(t),y(t),z(t)),\qquad t\in D.$$

The solver substitutes this candidate into both equations and checks the real parameter domain, including restrictions from denominators, roots, and logarithms. Supported strategies include affine plane intersections, selected quadric sections, circular/elliptic cylinder cuts, and coordinate parameterizations. Periodic curves use a fundamental interval when applicable. For example, the intersection of $x^2+y^2=4$ and $z=x+y$ is

$$\mathbf{r}(t)=(2\cos t,2\sin t,2\cos t+2\sin t),\qquad t\in[0,2\pi).$$

The current solver also checks for omitted branches and rejects selected cases requiring disconnected components, such as $x^2+y^2=4$ with $z^2=1$. These checks are implemented strategies, not a universal coverage proof. Proved empty intersections, isolated points, unsupported input, and inconclusive searches have distinct outcomes. No claim of universal exact solvability or a globally simplest formula is made.

**Verification limitation:** the current implementation includes numerical identity fallbacks and sampled coverage witnesses when symbolic simplification is inconclusive. These are not mathematical proofs for arbitrary inputs. Exact-form output should be independently checked when a rigorous proof is required. Surface meshes and curve samples are finite-resolution visual approximations.

Calculation/navigation bounds are $[-1000,1000]^3$; the initial reference region is $[-50,50]^3$. Bounds describe the application's working region, not a proof about all real space.

## Setup and development

Use Node.js 22.12+ and npm 10.5+. The repository pins Node.js 22.16.0 for Cloudflare Pages. Dependency acquisition happens at build time; runtime computation remains local.

```bash
git clone https://github.com/juxdeveloper/Intersect.git
cd Intersect
npm ci
npm run prepare:runtime
npm run dev
```

The development server runs at `http://localhost:5173`. Prepare runtime assets before using the development server on a fresh checkout:

```bash
npm run prepare:runtime
```

Preparation copies Pyodide and fonts from installed dependencies and downloads checksum-verified SymPy/mpmath wheels if absent. It requires an internet connection on a fresh setup; subsequent builds reuse verified local wheels.

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` prepares local runtime assets, checks TypeScript, builds `dist/`, and generates the offline cache manifest. Production preview uses `http://localhost:4173`.

## Using the application

1. Enter an equation in each surface field. The preview updates while typing; valid changes trigger automatic calculation.
2. Read the formula and parameter domain, or the stated reason a result could not be determined.
3. Expand the procedure to inspect the calculation steps. Change direction to reverse traversal.
4. Orbit, pan, and zoom the graph with mouse or touch. Use the detail control to adjust graphics quality.
5. Open History to restore or delete calculations. History belongs to the current browser origin and can be cleared by the browser.
6. Switch language or theme in the header. Wait for offline preparation before relying on offline access.

WebGL is required for the 3D view. PWA installation and service workers require HTTPS or localhost and browser support. A first visit cannot work offline before assets are cached. If runtime initialization fails, check local asset availability and use the retry control; a timeout or unsupported equation does not establish that an intersection is empty.

