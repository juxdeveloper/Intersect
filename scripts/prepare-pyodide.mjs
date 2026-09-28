/**
 * Preparation script for local Pyodide and SymPy runtime assets.
 *
 * Responsibilities:
 * 1. Copies core Pyodide 0.27.8 static assets from node_modules/pyodide to public/pyodide/
 * 2. Fetches/caches pinned SymPy 1.13.3 and Mpmath 1.3.0 wheels with strict SHA256 checksum verification
 * 3. Creates public/pyodide/manifest.json with file sizes and SHA256 hashes
 * 4. Creates public/pyodide/LICENSES.txt with redistribution licenses
 * 5. Mirrors manifest.json into src/runtime/manifest.json for TypeScript compile-time import
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TARGET_DIR = path.join(rootDir, 'public', 'pyodide');
const SRC_RUNTIME_DIR = path.join(rootDir, 'src', 'runtime');
const NODE_PYODIDE_DIR = path.join(rootDir, 'node_modules', 'pyodide');

const PINNED_CONFIG = {
  pyodideVersion: '0.27.8',
  pythonVersion: '3.12.7',
  sympyVersion: '1.13.3',
  mpmathVersion: '1.3.0',
};

const WHEEL_SPECS = [
  {
    name: 'mpmath',
    fileName: 'mpmath-1.3.0-py3-none-any.whl',
    expectedSha256: '5c8b3c27ea61c54b90c56a5adf9ddb07d7c3591b80e9f83d4f03009bba6f5ac5',
    url: 'https://cdn.jsdelivr.net/pyodide/v0.27.8/full/mpmath-1.3.0-py3-none-any.whl',
    license: 'BSD-3-Clause',
  },
  {
    name: 'sympy',
    fileName: 'sympy-1.13.3-py3-none-any.whl',
    expectedSha256: 'f36c07ec53e3992f8d02ea833e4e277c51138791f07b508677dd37ef5c2965dd',
    url: 'https://cdn.jsdelivr.net/pyodide/v0.27.8/full/sympy-1.13.3-py3-none-any.whl',
    license: 'BSD-3-Clause',
  },
];

const CORE_FILES = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
  'pyodide.mjs',
];

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function prepare() {
  console.log('--- Preparing Pyodide & SymPy local runtime assets ---');

  if (!fs.existsSync(NODE_PYODIDE_DIR)) {
    throw new Error(`node_modules/pyodide not found at ${NODE_PYODIDE_DIR}. Run npm install first.`);
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.mkdirSync(SRC_RUNTIME_DIR, { recursive: true });

  // 1. Copy core Pyodide files
  console.log('Copying core Pyodide runtime files...');
  for (const file of CORE_FILES) {
    const src = path.join(NODE_PYODIDE_DIR, file);
    const dest = path.join(TARGET_DIR, file);
    if (!fs.existsSync(src)) {
      throw new Error(`Required Pyodide file missing: ${src}`);
    }
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
  }

  // 2. Fetch and verify wheels
  for (const wheel of WHEEL_SPECS) {
    const dest = path.join(TARGET_DIR, wheel.fileName);
    let needDownload = true;

    if (fs.existsSync(dest)) {
      const existingHash = computeSha256(dest);
      if (existingHash === wheel.expectedSha256) {
        console.log(`  ✓ ${wheel.fileName} (verified existing sha256)`);
        needDownload = false;
      } else {
        console.log(`  ! Hash mismatch for ${wheel.fileName}, re-downloading...`);
      }
    }

    if (needDownload) {
      console.log(`  Downloading ${wheel.fileName}...`);
      await downloadFile(wheel.url, dest);
      const downloadedHash = computeSha256(dest);
      if (downloadedHash !== wheel.expectedSha256) {
        fs.unlinkSync(dest);
        throw new Error(
          `SHA256 checksum mismatch for ${wheel.fileName}!\nExpected: ${wheel.expectedSha256}\nActual:   ${downloadedHash}`,
        );
      }
      console.log(`  ✓ ${wheel.fileName} (downloaded and verified sha256)`);
    }
  }

  // 3. Generate Manifest
  console.log('Generating runtime asset manifest...');
  const files = [...CORE_FILES, ...WHEEL_SPECS.map((w) => w.fileName)];
  let totalBytes = 0;
  const manifestFiles = {};

  for (const file of files) {
    const filePath = path.join(TARGET_DIR, file);
    const stat = fs.statSync(filePath);
    const sha256 = computeSha256(filePath);
    totalBytes += stat.size;
    manifestFiles[file] = {
      size: stat.size,
      sha256,
    };
  }

  const manifest = {
    manifestVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    versions: PINNED_CONFIG,
    totalBytes,
    totalFormattedSize: `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`,
    files: manifestFiles,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const targetManifestPath = path.join(TARGET_DIR, 'manifest.json');
  const srcManifestPath = path.join(SRC_RUNTIME_DIR, 'manifest.json');

  fs.writeFileSync(targetManifestPath, manifestJson);
  fs.writeFileSync(srcManifestPath, manifestJson);
  console.log(`  ✓ manifest.json written (${manifest.totalFormattedSize} total distribution)`);

  // 4. Copy MathLive KaTeX Fonts
  console.log('Copying MathLive KaTeX fonts to public/fonts/...');
  const mathliveFontsSrc = path.join(rootDir, 'node_modules', 'mathlive', 'fonts');
  const fontsTargetDir = path.join(rootDir, 'public', 'fonts');
  if (fs.existsSync(mathliveFontsSrc)) {
    fs.mkdirSync(fontsTargetDir, { recursive: true });
    const fontFiles = fs.readdirSync(mathliveFontsSrc);
    for (const fontFile of fontFiles) {
      if (fontFile.endsWith('.woff2')) {
        fs.copyFileSync(path.join(mathliveFontsSrc, fontFile), path.join(fontsTargetDir, fontFile));
      }
    }
    console.log(`  ✓ ${fontFiles.length} MathLive KaTeX fonts copied`);
  } else {
    console.warn(`  ! MathLive fonts source not found at ${mathliveFontsSrc}`);
  }

  // 5. Write Redistribution Licenses
  const licensesContent = `Intersect — Runtime Asset Redistribution Notices
==================================================

1. Pyodide (${PINNED_CONFIG.pyodideVersion})
License: Mozilla Public License 2.0 (MPL-2.0)
https://github.com/pyodide/pyodide/blob/main/LICENSE
This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.

2. CPython (${PINNED_CONFIG.pythonVersion} standard library and WebAssembly binary)
License: Python Software Foundation License Version 2 (PSF-2.0)
https://docs.python.org/3/license.html

3. SymPy (${PINNED_CONFIG.sympyVersion})
License: 3-Clause BSD License (BSD-3-Clause)
Copyright (c) 2006-2024 SymPy Development Team
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list
   of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or other
   materials provided with the distribution.
3. Neither the name of SymPy nor the names of its contributors may be used to endorse
   or promote products derived from this software without specific prior written permission.

4. Mpmath (${PINNED_CONFIG.mpmathVersion})
License: 3-Clause BSD License (BSD-3-Clause)
Copyright (c) 2005-2023 Fredrik Johansson and mpmath contributors
All rights reserved.

5. MathLive (0.110.0)
License: MIT License
Copyright (c) 2017 - present Arno Gourdol. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.

6. KaTeX Fonts
License: SIL Open Font License, Version 1.1 (OFL-1.1)
Copyright (c) 2013-2020 Khan Academy (http://www.khanacademy.org).
This Font Software is licensed under the SIL Open Font License, Version 1.1.
`;

  fs.writeFileSync(path.join(TARGET_DIR, 'LICENSES.txt'), licensesContent);
  fs.writeFileSync(path.join(rootDir, 'public', 'LICENSES.txt'), licensesContent);
  console.log('  ✓ LICENSES.txt written');
  console.log('Runtime assets preparation completed successfully.');
}

prepare().catch((err) => {
  console.error('Asset preparation failed:', err);
  process.exit(1);
});
