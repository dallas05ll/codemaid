import { existsSync } from 'node:fs';
import path from 'node:path';

const JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const PY_EXTENSIONS = ['.py'];

/**
 * Resolve a JS/TS import specifier to an absolute file path.
 * Handles: relative paths, index files, extension omission.
 */
export function resolveJsImport(specifier: string, fromFile: string, allFiles: Set<string>): string | null {
  // Skip bare specifiers (npm packages)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, specifier);

  // Try exact match
  if (allFiles.has(base)) return base;

  // Try adding extensions
  for (const ext of JS_EXTENSIONS) {
    const withExt = base + ext;
    if (allFiles.has(withExt)) return withExt;
  }

  // Handle TypeScript convention: imports use .js extension but actual files are .ts
  // e.g., import specifier ends with .js but the source file has a .ts extension
  if (base.endsWith('.js')) {
    const tsBase = base.slice(0, -3);
    for (const ext of ['.ts', '.tsx']) {
      if (allFiles.has(tsBase + ext)) return tsBase + ext;
    }
  }

  // Try index files
  for (const ext of JS_EXTENSIONS) {
    const indexFile = path.join(base, `index${ext}`);
    if (allFiles.has(indexFile)) return indexFile;
  }

  return null;
}

/**
 * Resolve a Python dotted import to an absolute file path.
 * Handles: `from app.models.user import User` → `app/models/user.py`
 */
export function resolvePythonImport(modulePath: string, rootDir: string, allFiles: Set<string>): string | null {
  const parts = modulePath.split('.');
  const filePath = path.join(rootDir, ...parts) + '.py';
  if (allFiles.has(filePath)) return filePath;

  // Try as package (__init__.py)
  const initPath = path.join(rootDir, ...parts, '__init__.py');
  if (allFiles.has(initPath)) return initPath;

  return null;
}

/**
 * Check if a file path exists (used for markdown link validation).
 */
export function resolveRelativePath(linkPath: string, fromFile: string): string | null {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, linkPath);
  return existsSync(resolved) ? resolved : null;
}
