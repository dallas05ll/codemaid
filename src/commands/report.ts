import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { ScanReport } from '../core/types.js';
import * as logger from '../utils/logger.js';

const CACHE_FILE = '.codemaid-report.json';

export function saveReport(report: ScanReport): void {
  const cachePath = path.join(report.rootDir, CACHE_FILE);
  writeFileSync(cachePath, JSON.stringify(report, null, 2), 'utf-8');
}

export function loadCachedReport(rootDir: string): ScanReport | null {
  const cachePath = path.join(rootDir, CACHE_FILE);
  if (!existsSync(cachePath)) {
    logger.warn('No cached report found. Run `codemaid scan` first.');
    return null;
  }

  try {
    const content = readFileSync(cachePath, 'utf-8');
    return JSON.parse(content) as ScanReport;
  } catch {
    logger.error('Failed to read cached report.');
    return null;
  }
}
