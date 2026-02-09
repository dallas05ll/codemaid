/**
 * Agent Adapter — one-function API for programmatic consumers.
 *
 * Usage:
 *   import { scanProject } from 'codemaid/agent';
 *   const report = await scanProject('./my-project', { only: 'javascript', minConfidence: 'medium' });
 */

import path from 'node:path';
import { loadConfig } from './core/config.js';
import { ScanOrchestrator } from './core/scanner.js';
import type { ScanReport, IssueConfidence } from './core/types.js';

export interface AgentScanOptions {
  /** Scan only a specific language: 'python', 'js', 'docs', 'css', 'config' */
  only?: string;
  /** Filter results to this confidence level or higher. 'high' = only high, 'medium' = high+medium, 'low' = everything */
  minConfidence?: IssueConfidence;
  /** Path to .codemaidrc.json */
  config?: string;
}

const CONFIDENCE_RANK: Record<IssueConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Scan a project directory and return a structured ScanReport.
 *
 * This is the primary entry point for agents consuming codemaid programmatically.
 * The returned report uses relative file paths for portability.
 */
export async function scanProject(
  dir: string,
  options: AgentScanOptions = {},
): Promise<ScanReport> {
  const rootDir = path.resolve(dir);
  const config = loadConfig(rootDir, options.config ? { rootDir } : {});

  const orchestrator = new ScanOrchestrator(config);
  const report = await orchestrator.scan(config, options.only);

  // Convert paths to relative for portability
  const relativeReport: ScanReport = {
    ...report,
    issues: report.issues.map(issue => ({
      ...issue,
      filePath: path.relative(report.rootDir, issue.filePath),
      trace: issue.trace?.map(t => path.relative(report.rootDir, t)),
    })),
  };

  // Apply confidence filter if specified
  if (options.minConfidence) {
    const minRank = CONFIDENCE_RANK[options.minConfidence];
    relativeReport.issues = relativeReport.issues.filter(issue => {
      // Issues without confidence (non-export categories) always pass through
      if (!issue.confidence) return true;
      return CONFIDENCE_RANK[issue.confidence] >= minRank;
    });
  }

  return relativeReport;
}
