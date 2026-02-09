import { describe, it, expect } from 'vitest';
import { resolveJsImport, resolvePythonImport } from '../../src/core/resolver.js';

describe('resolveJsImport', () => {
  const allFiles = new Set([
    '/project/src/utils.ts',
    '/project/src/components/App.tsx',
    '/project/src/components/index.ts',
    '/project/src/lib/helpers.js',
  ]);

  it('should resolve relative imports with extension omission', () => {
    const result = resolveJsImport('./utils', '/project/src/index.ts', allFiles);
    expect(result).toBe('/project/src/utils.ts');
  });

  it('should resolve .js extension to .ts file (TypeScript convention)', () => {
    const result = resolveJsImport('./utils.js', '/project/src/index.ts', allFiles);
    expect(result).toBe('/project/src/utils.ts');
  });

  it('should resolve index files', () => {
    const result = resolveJsImport('./components', '/project/src/index.ts', allFiles);
    expect(result).toBe('/project/src/components/index.ts');
  });

  it('should return null for bare imports (npm packages)', () => {
    const result = resolveJsImport('react', '/project/src/index.ts', allFiles);
    expect(result).toBeNull();
  });

  it('should return null for unresolvable paths', () => {
    const result = resolveJsImport('./nonexistent', '/project/src/index.ts', allFiles);
    expect(result).toBeNull();
  });
});

describe('resolvePythonImport', () => {
  const allFiles = new Set([
    '/project/app/auth.py',
    '/project/app/models/user.py',
    '/project/app/models/__init__.py',
  ]);

  it('should resolve dotted module path', () => {
    const result = resolvePythonImport('app.auth', '/project', allFiles);
    expect(result).toBe('/project/app/auth.py');
  });

  it('should resolve nested dotted path', () => {
    const result = resolvePythonImport('app.models.user', '/project', allFiles);
    expect(result).toBe('/project/app/models/user.py');
  });

  it('should resolve package (__init__.py)', () => {
    const result = resolvePythonImport('app.models', '/project', allFiles);
    expect(result).toBe('/project/app/models/__init__.py');
  });

  it('should return null for unresolvable paths', () => {
    const result = resolvePythonImport('app.nonexistent', '/project', allFiles);
    expect(result).toBeNull();
  });
});
