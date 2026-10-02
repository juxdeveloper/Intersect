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

