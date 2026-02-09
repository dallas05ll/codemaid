import { Command } from 'commander';
import { runScan } from './commands/scan.js';
import { runClean } from './commands/clean.js';
import { runInit } from './commands/init.js';
import { loadCachedReport, saveReport } from './commands/report.js';
import { ConsoleReporter } from './reporters/console-reporter.js';
import { JsonReporter } from './reporters/json-reporter.js';
import { setVerbose } from './utils/logger.js';

const program = new Command();

program
  .name('codemaid')
  .description('Dead code detector and codebase hygiene tool')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan the codebase for dead code and hygiene issues')
  .argument('[dir]', 'Directory to scan', '.')
  .option('--only <type>', 'Scan only: python, js, docs, css, config')
  .option('--format <format>', 'Output format: console, json', 'console')
  .option('--verbose', 'Show detailed output')
  .option('--config <path>', 'Path to .codemaidrc.json')
  .action(async (dir: string, opts: Record<string, string | boolean>) => {
    if (opts.verbose) setVerbose(true);

    const report = await runScan(dir, {
      only: opts.only as string,
      format: (opts.format as 'console' | 'json') ?? 'console',
      verbose: opts.verbose as boolean,
    });

    // Cache report for later use
    saveReport(report);

    // Render output
    const reporter = opts.format === 'json'
      ? new JsonReporter()
      : new ConsoleReporter();

    const output = await reporter.render(report);
    console.log(output);

    // Exit with non-zero if errors found
    const errors = report.issues.filter(i => i.severity === 'error').length;
    if (errors > 0) process.exit(1);
  });

program
  .command('clean')
  .description('Interactively fix detected issues')
  .argument('[dir]', 'Directory to clean', '.')
  .option('--dry-run', 'Preview changes without modifying files')
  .option('--auto', 'Automatically fix all actionable issues')
  .option('--verbose', 'Show detailed output')
  .action(async (dir: string, opts: Record<string, boolean>) => {
    if (opts.verbose) setVerbose(true);

    // First scan, then clean
    const report = await runScan(dir, {});
    await runClean(report, {
      dryRun: opts.dryRun,
      auto: opts.auto,
    });
  });

program
  .command('report')
  .description('Show the last cached scan report')
  .argument('[dir]', 'Project directory', '.')
  .option('--format <format>', 'Output format: console, json', 'console')
  .option('--detail <category>', 'Drill into a category: dead-files, unused-exports, stale-refs, unused-deps, doc-drift, modularity')
  .action(async (dir: string, opts: Record<string, string>) => {
    const report = loadCachedReport(dir);
    if (!report) return;

    // If --detail is specified, filter to that category and show rich output
    if (opts.detail) {
      const categoryMap: Record<string, string> = {
        'dead-files': 'dead-file',
        'unused-exports': 'unused-export',
        'stale-refs': 'stale-reference',
        'unused-deps': 'unused-dependency',
        'doc-drift': 'doc-drift',
        'modularity': 'modularity',
      };
      const cat = categoryMap[opts.detail];
      if (!cat) {
        console.error(`Unknown category: ${opts.detail}`);
        console.error('Available: dead-files, unused-exports, stale-refs, unused-deps, doc-drift, modularity');
        process.exit(1);
      }

      const filtered = report.issues.filter(i => i.category === cat);
      if (filtered.length === 0) {
        console.log(`No issues in category: ${opts.detail}`);
        return;
      }

      // Detailed view with confidence, reason, trace
      const { default: chalk } = await import('chalk');
      const { default: path } = await import('node:path');

      console.log('');
      console.log(chalk.bold.cyan(`=== ${opts.detail.toUpperCase()} (${filtered.length} issues) ===`));
      console.log('');

      for (const issue of filtered) {
        const relPath = path.relative(report.rootDir, issue.filePath);
        const loc = issue.line ? `${relPath}:${issue.line}` : relPath;
        const conf = issue.confidence ?? 'unknown';
        const confColor = conf === 'high' ? chalk.red : conf === 'medium' ? chalk.yellow : chalk.gray;

        console.log(chalk.bold(`  ${loc}`));
        console.log(`    ${issue.message}`);
        console.log(`    Confidence: ${confColor(conf.toUpperCase())}`);
        if (issue.reason) console.log(`    Reason: ${chalk.gray(issue.reason)}`);
        if (issue.trace && issue.trace.length > 0) {
          const relTrace = issue.trace.map(t => path.relative(report.rootDir, t)).join(' -> ');
          console.log(`    Trace: ${chalk.gray(relTrace)}`);
        }
        console.log('');
      }
      return;
    }

    const reporter = opts.format === 'json'
      ? new JsonReporter()
      : new ConsoleReporter();

    const output = await reporter.render(report);
    console.log(output);
  });

program
  .command('init')
  .description('Create a .codemaidrc.json configuration file')
  .argument('[dir]', 'Project directory', '.')
  .action(async (dir: string) => {
    await runInit(dir);
  });

// Default action: run scan
program
  .argument('[dir]', 'Directory to scan', '.')
  .action(async (dir: string) => {
    const report = await runScan(dir, { format: 'console' });
    saveReport(report);
    const reporter = new ConsoleReporter();
    const output = await reporter.render(report);
    console.log(output);
  });

program.parse();
