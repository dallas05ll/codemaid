import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { JavaScriptScanner } from '../../src/scanners/javascript-scanner.js';
import { DEFAULT_CONFIG } from '../../src/core/types.js';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/react-project');

describe('JavaScriptScanner', () => {
  const scanner = new JavaScriptScanner();

  it('should have correct name and extensions', () => {
    expect(scanner.name).toBe('javascript');
    expect(scanner.extensions).toContain('.ts');
    expect(scanner.extensions).toContain('.tsx');
    expect(scanner.extensions).toContain('.js');
  });

  it('should detect exports from TS files', async () => {
    const files = [
      path.join(FIXTURES_DIR, 'src/components/Header.ts'),
    ];
    const allFiles = files;
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, allFiles, config);

    expect(result.exports.length).toBeGreaterThan(0);
    expect(result.exports.some(e => e.name === 'Header')).toBe(true);
  });

  it('should detect imports from TS files', async () => {
    const files = [
      path.join(FIXTURES_DIR, 'src/components/App.ts'),
    ];
    const allFiles = [
      ...files,
      path.join(FIXTURES_DIR, 'src/components/Header.ts'),
      path.join(FIXTURES_DIR, 'src/hooks/useAuth.ts'),
    ];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, allFiles, config);

    expect(result.imports.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect unused package.json dependencies', async () => {
    const tsFiles = [
      path.join(FIXTURES_DIR, 'src/index.ts'),
      path.join(FIXTURES_DIR, 'src/components/App.ts'),
    ];
    const allFiles = [
      ...tsFiles,
      path.join(FIXTURES_DIR, 'package.json'),
    ];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(tsFiles, allFiles, config);

    const unusedDeps = result.issues.filter(i => i.category === 'unused-dependency');
    expect(unusedDeps.some(i => i.message.includes('unused-lib'))).toBe(true);
  });
});
