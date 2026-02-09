import path from 'node:path';
import { loadConfig } from '../core/config.js';
import { ScanOrchestrator } from '../core/scanner.js';
import type { ScanReport } from '../core/types.js';

export interface ScanOptions {
  config?: string;
  verbose?: boolean;
  format?: 'console' | 'json';
  only?: string;
}

export async function runScan(targetDir: string, options: ScanOptions): Promise<ScanReport> {
  const rootDir = path.resolve(targetDir);
  const config = loadConfig(rootDir, options.config ? { rootDir } : {});

  const orchestrator = new ScanOrchestrator(config);
  const report = await orchestrator.scan(config, options.only);

  return report;
}
