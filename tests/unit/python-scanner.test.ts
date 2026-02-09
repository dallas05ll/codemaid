import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { PythonScanner } from '../../src/scanners/python-scanner.js';
import { DEFAULT_CONFIG } from '../../src/core/types.js';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/python-project');

describe('PythonScanner', () => {
  const scanner = new PythonScanner();

  it('should detect function and class exports', async () => {
    const files = [
      path.join(FIXTURES_DIR, 'app/auth.py'),
      path.join(FIXTURES_DIR, 'app/dead_helper.py'),
    ];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, files, config);

    expect(result.exports.some(e => e.name === 'authenticate')).toBe(true);
    expect(result.exports.some(e => e.name === 'OldHelper' && e.kind === 'class')).toBe(true);
  });

  it('should detect Python imports', async () => {
    const files = [path.join(FIXTURES_DIR, 'main.py')];
    const allFiles = [
      ...files,
      path.join(FIXTURES_DIR, 'app/auth.py'),
      path.join(FIXTURES_DIR, 'app/database.py'),
    ];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, allFiles, config);

    expect(result.imports.some(i => i.fromModule === 'app.auth')).toBe(true);
    expect(result.imports.some(i => i.fromModule === 'app.database')).toBe(true);
  });

  it('should detect unused requirements.txt packages', async () => {
    const allPyFiles = [
      path.join(FIXTURES_DIR, 'main.py'),
      path.join(FIXTURES_DIR, 'app/auth.py'),
      path.join(FIXTURES_DIR, 'app/database.py'),
    ];
    const reqFile = path.join(FIXTURES_DIR, 'requirements.txt');
    const files = [...allPyFiles, reqFile];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, files, config);

    const unusedDeps = result.issues.filter(i => i.category === 'unused-dependency');
    expect(unusedDeps.some(i => i.message.includes('unused-package'))).toBe(true);
  });
});
