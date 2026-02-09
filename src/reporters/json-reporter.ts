import path from 'node:path';
import type { ReporterPlugin } from './base-reporter.js';
import type { ScanReport } from '../core/types.js';

export class JsonReporter implements ReporterPlugin {
  name = 'json';

  async render(report: ScanReport): Promise<string> {
    // Convert absolute paths to relative for portability
    // Preserves all fields: confidence, reason, trace — agents get everything
    const relativeReport = {
      ...report,
      issues: report.issues.map(issue => ({
        ...issue,
        filePath: path.relative(report.rootDir, issue.filePath),
        // Convert trace paths to relative too
        trace: issue.trace?.map(t => path.relative(report.rootDir, t)),
      })),
    };

    return JSON.stringify(relativeReport, null, 2);
  }
}
