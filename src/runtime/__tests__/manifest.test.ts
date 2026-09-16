import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import manifest from '../manifest.json';

describe('V3 Runtime Manifest & Local Asset Integrity', () => {
  const publicPyodideDir = path.resolve(process.cwd(), 'public', 'pyodide');

  it('contains expected pinned version metadata', () => {
    expect(manifest.versions.pyodideVersion).toBe('0.27.8');
    expect(manifest.versions.pythonVersion).toBe('3.12.7');
    expect(manifest.versions.sympyVersion).toBe('1.13.3');
    expect(manifest.versions.mpmathVersion).toBe('1.3.0');
  });

  it('lists all required core runtime files and wheels', () => {
    const expectedFiles = [
      'pyodide.asm.js',
      'pyodide.asm.wasm',
      'python_stdlib.zip',
      'pyodide-lock.json',
      'pyodide.mjs',
      'mpmath-1.3.0-py3-none-any.whl',
      'sympy-1.13.3-py3-none-any.whl',
    ];

    for (const file of expectedFiles) {
      expect(manifest.files).toHaveProperty(file);
    }
  });

  it('matches actual file existence, byte sizes, and sha256 checksums in public/pyodide/', () => {
    for (const [fileName, entry] of Object.entries(manifest.files)) {
      const filePath = path.join(publicPyodideDir, fileName);
      expect(fs.existsSync(filePath), `Missing asset: ${filePath}`).toBe(true);

      const stat = fs.statSync(filePath);
      expect(stat.size).toBe(entry.size);

      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      expect(hash).toBe(entry.sha256);
    }
  });

  it('includes complete redistribution notices in LICENSES.txt', () => {
    const licensesPath = path.join(publicPyodideDir, 'LICENSES.txt');
    expect(fs.existsSync(licensesPath)).toBe(true);

    const licenses = fs.readFileSync(licensesPath, 'utf-8');
    expect(licenses).toContain('Pyodide (0.27.8)');
    expect(licenses).toContain('Mozilla Public License 2.0 (MPL-2.0)');
    expect(licenses).toContain('CPython (3.12.7');
    expect(licenses).toContain('Python Software Foundation License');
    expect(licenses).toContain('SymPy (1.13.3)');
    expect(licenses).toContain('3-Clause BSD License');
    expect(licenses).toContain('Mpmath (1.3.0)');
  });
});
