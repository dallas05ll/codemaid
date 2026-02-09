import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ScanOrchestrator } from '../../src/core/scanner.js';
import { loadConfig } from '../../src/core/config.js';

describe('Full Scan Integration', () => {
  it('should scan a react project and find orphaned files', async () => {
    const rootDir = path.resolve(__dirname, '../fixtures/react-project');
    const config = loadConfig(rootDir);
    const orchestrator = new ScanOrchestrator(config);

    const report = await orchestrator.scan(config);

    // Should find OrphanedComponent.ts and useOldFeature.ts as dead files
    const deadFiles = report.issues.filter(i => i.category === 'dead-file');
    const deadPaths = deadFiles.map(i => path.basename(i.filePath));

    expect(deadPaths).toContain('OrphanedComponent.ts');
    expect(deadPaths).toContain('useOldFeature.ts');

    // Should NOT flag connected files
    expect(deadPaths).not.toContain('App.ts');
    expect(deadPaths).not.toContain('Header.ts');
    expect(deadPaths).not.toContain('useAuth.ts');
  });

  it('should scan a docs project and find broken links', async () => {
    const rootDir = path.resolve(__dirname, '../fixtures/docs-project');
    const config = loadConfig(rootDir);
    const orchestrator = new ScanOrchestrator(config);

    const report = await orchestrator.scan(config);

    const docDrift = report.issues.filter(i => i.category === 'doc-drift');
    expect(docDrift.length).toBeGreaterThanOrEqual(2);
  });

  it('should produce valid JSON output', async () => {
    const rootDir = path.resolve(__dirname, '../fixtures/react-project');
    const config = loadConfig(rootDir);
    const orchestrator = new ScanOrchestrator(config);

    const report = await orchestrator.scan(config);

    expect(report.timestamp).toBeTruthy();
    expect(report.duration).toBeGreaterThanOrEqual(0);
    expect(report.stats.filesScanned).toBeGreaterThan(0);
    expect(Array.isArray(report.issues)).toBe(true);
  });
});
