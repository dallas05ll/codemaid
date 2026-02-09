import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { MarkdownScanner } from '../../src/scanners/markdown-scanner.js';
import { DEFAULT_CONFIG } from '../../src/core/types.js';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/docs-project');

describe('MarkdownScanner', () => {
  const scanner = new MarkdownScanner();

  it('should detect broken markdown links', async () => {
    const files = [path.join(FIXTURES_DIR, 'README.md')];
    const allFiles = [
      ...files,
      path.join(FIXTURES_DIR, 'guide.md'),
    ];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, allFiles, config);

    // Should find broken links to nonexistent.md and api.md and ../missing/file.md
    const brokenLinks = result.issues.filter(i => i.category === 'doc-drift');
    expect(brokenLinks.length).toBeGreaterThanOrEqual(2);
    expect(brokenLinks.some(i => i.message.includes('nonexistent.md'))).toBe(true);
  });

  it('should not flag valid links', async () => {
    const files = [path.join(FIXTURES_DIR, 'guide.md')];
    const allFiles = [
      ...files,
      path.join(FIXTURES_DIR, 'README.md'),
    ];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, allFiles, config);

    // guide.md links to README.md which exists
    const brokenLinks = result.issues.filter(i => i.category === 'doc-drift');
    expect(brokenLinks).toHaveLength(0);
  });

  it('should skip external URLs', async () => {
    const files = [path.join(FIXTURES_DIR, 'README.md')];
    const config = { ...DEFAULT_CONFIG, rootDir: FIXTURES_DIR };

    const result = await scanner.scan(files, files, config);

    // No issues for https:// links
    const httpIssues = result.issues.filter(i =>
      i.message.includes('http://') || i.message.includes('https://')
    );
    expect(httpIssues).toHaveLength(0);
  });
});
