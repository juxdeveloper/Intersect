# Third-Party Open Source Asset & Dependency Inventory

This document provides a complete inventory of all open-source libraries, runtime binaries, packages, and fonts distributed with or utilized by **Intersect**.

---

## 1. Inventory Summary

| Component | Distributed Version | Role | License | Copyright Holder / Origin | Notice Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pyodide** | 0.27.8 | WebAssembly Python 3.12 runtime | MPL-2.0 | Pyodide Authors | `public/pyodide/LICENSES.txt` & `dist/pyodide/LICENSES.txt` |
| **CPython** | 3.12.7 | Python standard library & WASM binary | PSF-2.0 | Python Software Foundation | `public/pyodide/LICENSES.txt` & `dist/pyodide/LICENSES.txt` |
| **SymPy** | 1.13.3 | Pure-Python symbolic algebra library | BSD-3-Clause | SymPy Development Team | `public/pyodide/LICENSES.txt` & `dist/pyodide/LICENSES.txt` |
| **mpmath** | 1.3.0 | Arbitrary-precision floating-point arithmetic | BSD-3-Clause | Fredrik Johansson and mpmath contributors | `public/pyodide/LICENSES.txt` & `dist/pyodide/LICENSES.txt` |
| **Three.js** | 0.186.1 | WebGL 3D rendering, OrbitControls, and Marching Cubes lookup data | MIT | Copyright © 2010-2026 Three.js authors | Bundled in `dist/assets/three-vendor-*.js`; lookup data in `src/geometry/marching-cubes-tables.ts` and the geometry worker |
| **MathLive** | 0.110.0 | LaTeX math formula input & virtual keyboard | MIT | Copyright © 2017-present Arno Gourdol | Bundled in `dist/assets/mathlive-vendor-*.js` |
| **KaTeX Fonts** | 20 .woff2 files | Math typography for MathLive keyboard | SIL OFL-1.1 | Copyright © 2013-2020 Khan Academy | `public/fonts/LICENSES.txt` & `dist/fonts/LICENSES.txt` |
| **Compute Engine**| 0.136.2 | MathJSON expression parsing and manipulation | MIT | Copyright © 2019-present CortexJS / Arno Gourdol | Bundled in `dist/assets/compute-engine-vendor-*.js` |
| **React** | 19.3.0 | UI rendering library | MIT | Copyright © Meta Platforms, Inc. and affiliates | Bundled in `dist/assets/react-vendor-*.js` |
| **React-DOM** | 19.3.0 | DOM renderer for React | MIT | Copyright © Meta Platforms, Inc. and affiliates | Bundled in `dist/assets/react-vendor-*.js` |

---

## 2. Redistribution Notice Details

### A. Pyodide
- **Version**: 0.27.8
- **Files**: `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`, `pyodide.mjs`
- **License**: Mozilla Public License Version 2.0 (MPL-2.0)
- **Source Link**: https://github.com/pyodide/pyodide
- **Redistribution Terms**: Covered software is distributed under the terms of the MPL-2.0. Source code for Pyodide is available at the upstream repository.

### B. Python Software Foundation License (CPython)
- **Version**: 3.12.7 (bundled within Pyodide WebAssembly build and stdlib zip)
- **License**: Python Software Foundation License Version 2 (PSF-2.0)
- **Origin**: Python Software Foundation (https://www.python.org/)

### C. SymPy
- **Version**: 1.13.3 (`sympy-1.13.3-py3-none-any.whl`, SHA-256: `f36c07ec76b7260cf8dbf58d0fc659858525b6a7a00fb4c919d3630f9bf5173e`)
- **License**: 3-Clause BSD License (BSD-3-Clause)
- **Copyright**: Copyright (c) 2006-2024 SymPy Development Team. All rights reserved.
- **Notice**:
```text
Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list
   of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or other
   materials provided with the distribution.
3. Neither the name of SymPy nor the names of its contributors may be used to endorse
   or promote products derived from this software without specific prior written permission.
```

### D. mpmath
- **Version**: 1.3.0 (`mpmath-1.3.0-py3-none-any.whl`, SHA-256: `5c8b3c27e85c7c427e9929f6da21b44ecdd2ef29f2c342f741ad7755b6ef9436`)
- **License**: 3-Clause BSD License (BSD-3-Clause)
- **Copyright**: Copyright (c) 2005-2023 Fredrik Johansson and mpmath contributors. All rights reserved.

### E. Three.js
- **Version**: 0.186.1
- **License**: MIT License
- **Copyright**: Copyright © 2010-2026 Three.js authors
- **Notice**:
```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
```

### F. MathLive
- **Version**: 0.110.0
- **License**: MIT License
- **Copyright**: Copyright (c) 2017 - present Arno Gourdol. All rights reserved.

### G. KaTeX Fonts
- **Files**: 20 `.woff2` font files in `public/fonts/` (KaTeX_AMS-Regular, KaTeX_Main-*, KaTeX_Math-*, KaTeX_Size*, etc.)
- **License**: SIL Open Font License, Version 1.1 (OFL-1.1)
- **Copyright**: Copyright (c) 2013-2020 Khan Academy (http://www.khanacademy.org).
- **Notice**: Included in full in `public/fonts/LICENSES.txt` and `dist/fonts/LICENSES.txt`.

### H. CortexJS Compute Engine
- **Version**: 0.136.2
- **License**: MIT License
- **Copyright**: Copyright (c) 2019 CortexJS

### I. React and React-DOM
- **Version**: 19.3.0
- **License**: MIT License
- **Copyright**: Copyright (c) Meta Platforms, Inc. and affiliates.

---

## 3. Application License Status

The application itself is licensed under the **GNU General Public License v3.0 (GPL-3.0)** (see [LICENSE](file:///home/joseph/Intersect/LICENSE)).

- **License**: GNU General Public License v3.0 (GPL-3.0-or-later)
- **Copyright**: Copyright (C) 2026 Intersect Authors
- **Distribution**: All third-party dependencies listed above possess permissive (MIT, BSD-3-Clause, PSF-2.0, SIL OFL-1.1) or weak-copyleft (MPL-2.0) terms that are compatible with GPL-3.0 distribution in an integrated web application package.
