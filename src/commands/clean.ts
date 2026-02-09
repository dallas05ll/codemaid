import path from 'node:path';
import { existsSync } from 'node:fs';
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import type { ScanReport, Issue } from '../core/types.js';
import { BackupManager } from '../core/backup.js';
import { deleteFile } from '../cleaners/file-deleter.js';
import { removeImportLine } from '../cleaners/import-cleaner.js';
import { removeBrokenLink } from '../cleaners/link-cleaner.js';
import * as logger from '../utils/logger.js';

export interface CleanOptions {
  dryRun?: boolean;
  auto?: boolean;
}

export async function runClean(report: ScanReport, options: CleanOptions): Promise<void> {
  const actionable = report.issues.filter(i => i.action !== 'skip');

  if (actionable.length === 0) {
    logger.success('No actionable issues to clean.');
    return;
  }

  // Pre-flight: verify all target files still exist
  const stale = actionable.filter(i => !existsSync(i.filePath));
  if (stale.length > 0) {
    logger.warn(`${stale.length} file(s) no longer exist since scan — skipping them`);
  }
  const valid = actionable.filter(i => existsSync(i.filePath));

  if (valid.length === 0) {
    logger.info('All actionable files have been moved or deleted. Nothing to do.');
    return;
  }

  // Group by action type
  const deletes = valid.filter(i => i.action === 'delete');
  const updates = valid.filter(i => i.action === 'update');
  const skips = report.issues.filter(i => i.action === 'skip');

  console.log('');
  console.log(chalk.bold('Cleanup Plan:'));
  console.log('');

  if (deletes.length > 0) {
    console.log(chalk.red.bold(`DELETE (${deletes.length} files):`));
    for (const issue of deletes) {
      const rel = path.relative(report.rootDir, issue.filePath);
      console.log(`  ${chalk.red('x')} ${rel} -- ${issue.message}`);
    }
    console.log('');
  }

  if (updates.length > 0) {
    console.log(chalk.yellow.bold(`UPDATE (${updates.length} files):`));
    for (const issue of updates) {
      const rel = path.relative(report.rootDir, issue.filePath);
      console.log(`  ${chalk.yellow('~')} ${rel} -- ${issue.message}`);
    }
    console.log('');
  }

  if (skips.length > 0) {
    console.log(chalk.gray(`SKIP (advisory only, ${skips.length} items)`));
    console.log('');
  }

  let selected: Issue[];

  if (options.auto) {
    selected = valid;
    logger.info(`Auto-fixing ${selected.length} issues...`);
  } else {
    // Interactive selection
    const choices = valid.map((issue, idx) => {
      const rel = path.relative(report.rootDir, issue.filePath);
      const action = issue.action === 'delete' ? chalk.red('DELETE') : chalk.yellow('UPDATE');
      return {
        name: `${action} ${rel} -- ${issue.message}`,
        value: idx,
        checked: true,
      };
    });

    const selectedIndices = await checkbox({
      message: 'Select issues to fix:',
      choices,
    });

    selected = selectedIndices.map(i => valid[i]);
  }

  if (selected.length === 0) {
    logger.info('No issues selected. Nothing to do.');
    return;
  }

  // Create backup before modifying anything
  const backup = new BackupManager(report.rootDir);
  const dryRun = options.dryRun ?? false;

  if (!dryRun) {
    logger.info('Creating backup of affected files...');
    for (const issue of selected) {
      backup.backup(issue.filePath);
    }
    logger.success(`Backed up ${backup.backedUpCount} files`);
  }

  // Execute fixes
  let fixed = 0;
  let failed = 0;

  for (const issue of selected) {
    const success = executeFix(issue, dryRun);
    if (success) fixed++;
    else failed++;
  }

  // If too many failures, offer rollback
  if (!dryRun && failed > 0 && fixed > 0) {
    logger.warn(`${failed} operation(s) failed. Backups are preserved at .codemaid-backup/`);
    logger.info('Run with --dry-run first to preview changes safely.');
  } else if (!dryRun && failed === 0) {
    // All succeeded — clean up backup
    backup.cleanup();
  }

  console.log('');
  logger.success(`Done: ${fixed} fixed, ${failed} failed${dryRun ? ' (dry run)' : ''}`);
}

function executeFix(issue: Issue, dryRun: boolean): boolean {
  switch (issue.action) {
    case 'delete':
      return deleteFile(issue.filePath, dryRun);

    case 'update':
      if (!issue.fix) return false;

      switch (issue.fix.type) {
        case 'remove-import':
          return removeImportLine(issue.filePath, issue.fix.target, dryRun);
        case 'remove-link':
          return removeBrokenLink(issue.filePath, issue.fix.target, dryRun);
        default:
          logger.warn(`Unsupported fix type: ${issue.fix.type}`);
          return false;
      }

    default:
      return false;
  }
}
