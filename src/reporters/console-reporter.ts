import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import path from 'node:path';
import type { ReporterPlugin } from './base-reporter.js';
import type { ScanReport, Issue, IssueCategory } from '../core/types.js';

const SEVERITY_ICONS: Record<string, string> = {
  error: chalk.red('X'),
  warning: chalk.yellow('!'),
  info: chalk.blue('i'),
};

const CATEGORY_TITLES: Record<IssueCategory, string> = {
  'dead-file': 'DEAD FILES',
  'stale-reference': 'STALE REFERENCES',
  'unused-dependency': 'UNUSED DEPENDENCIES',
  'unused-export': 'UNUSED EXPORTS',
  'doc-drift': 'DOCUMENTATION DRIFT',
  'modularity': 'MODULARITY ISSUES',
};

const CATEGORY_ORDER: IssueCategory[] = [
  'dead-file',
  'stale-reference',
  'unused-dependency',
  'unused-export',
  'doc-drift',
  'modularity',
];

const CONFIDENCE_BADGE: Record<string, string> = {
  high: chalk.red('[HIGH]'),
  medium: chalk.yellow('[MED]'),
  low: chalk.gray('[LOW]'),
};

export class ConsoleReporter implements ReporterPlugin {
  name = 'console';

  async render(report: ScanReport): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(chalk.bold.cyan('=== CodeMaid Scan Report ==='));
    lines.push('');

    if (report.issues.length === 0) {
      lines.push(chalk.green.bold('  No issues found! Your codebase is clean.'));
      lines.push('');
      return lines.join('\n');
    }

    // Group issues by category
    const grouped = new Map<IssueCategory, Issue[]>();
    for (const issue of report.issues) {
      const list = grouped.get(issue.category) ?? [];
      list.push(issue);
      grouped.set(issue.category, list);
    }

    // Render each category section
    let sectionNum = 1;
    for (const category of CATEGORY_ORDER) {
      const issues = grouped.get(category);
      if (!issues || issues.length === 0) continue;

      lines.push(chalk.bold(`${sectionNum}. ${CATEGORY_TITLES[category]}`) + chalk.gray(` (${issues.length})`));
      lines.push('');

      const table = new Table({
        head: ['', 'File', 'Issue'].map(h => chalk.gray(h)),
        colWidths: [4, 50, 60],
        wordWrap: true,
        style: { head: [], border: ['gray'] },
      });

      for (const issue of issues) {
        const icon = SEVERITY_ICONS[issue.severity];
        const relPath = path.relative(report.rootDir, issue.filePath);
        const location = issue.line ? `${relPath}:${issue.line}` : relPath;
        const badge = issue.confidence ? ` ${CONFIDENCE_BADGE[issue.confidence]}` : '';

        table.push([icon, location, issue.message + badge]);
      }

      lines.push(table.toString());
      lines.push('');
      sectionNum++;
    }

    // Summary box
    const { stats } = report;
    const totalIssues = report.issues.length;
    const errors = report.issues.filter(i => i.severity === 'error').length;
    const warnings = report.issues.filter(i => i.severity === 'warning').length;
    const infos = report.issues.filter(i => i.severity === 'info').length;

    const summaryText = [
      `Files scanned: ${stats.filesScanned}`,
      `Total issues:  ${totalIssues}`,
      '',
      `${chalk.red('X')} Errors:   ${errors}`,
      `${chalk.yellow('!')} Warnings: ${warnings}`,
      `${chalk.blue('i')} Info:     ${infos}`,
      '',
      `Duration: ${report.duration}ms`,
    ].join('\n');

    lines.push(boxen(summaryText, {
      title: 'Summary',
      titleAlignment: 'center',
      padding: 1,
      borderColor: totalIssues > 0 ? 'yellow' : 'green',
      borderStyle: 'round',
    }));

    lines.push('');
    if (errors > 0 || warnings > 0) {
      lines.push(chalk.cyan('Run ') + chalk.bold('codemaid clean') + chalk.cyan(' to interactively fix these issues.'));
    }
    lines.push('');

    return lines.join('\n');
  }
}
