import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pyPath = path.join(rootDir, 'src', 'runtime', 'sympy_builder.py');
const tsPath = path.join(rootDir, 'src', 'runtime', 'python-source.ts');

const pyContent = fs.readFileSync(pyPath, 'utf8');
const tsContent = `/**
 * Generated and vendored Python source for Pyodide/SymPy AST builder and solver.
 *
 * This file embeds \`sympy_builder.py\` so that it can be loaded directly into
 * the Web Worker environment via pyodide.runPython(SYMPY_BUILDER_PYTHON_SOURCE).
 */

export const SYMPY_BUILDER_PYTHON_SOURCE = ${JSON.stringify(pyContent)};
`;

fs.writeFileSync(tsPath, tsContent, 'utf8');
console.log('✓ Synced sympy_builder.py to python-source.ts');
