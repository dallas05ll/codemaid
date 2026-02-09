import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import * as logger from '../utils/logger.js';

/**
 * Backup manager for safe cleanup operations.
 *
 * Before any file modification, the original content is saved to a
 * timestamped .codemaid-backup/ directory. If anything goes wrong,
 * the entire batch can be rolled back with restoreAll().
 *
 * Backup files are stored as flat name-mangled copies to avoid
 * needing to recreate nested directory structures.
 */
export class BackupManager {
  private backupDir: string;
  private manifests = new Map<string, string>(); // originalPath → backupPath

  constructor(rootDir: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupDir = path.join(rootDir, '.codemaid-backup', timestamp);
  }

  /** Snapshot a file before modifying it. Idempotent — won't re-backup. */
  backup(filePath: string): boolean {
    if (this.manifests.has(filePath)) return true; // already backed up

    if (!existsSync(filePath)) {
      logger.debug(`Skipping backup of ${filePath} — file does not exist`);
      return false;
    }

    try {
      mkdirSync(this.backupDir, { recursive: true });

      // Mangle path: /foo/bar/baz.ts → foo__bar__baz.ts
      const safeName = filePath.replace(/[/\\:]/g, '__');
      const backupPath = path.join(this.backupDir, safeName);

      const content = readFileSync(filePath, 'utf-8');
      writeFileSync(backupPath, content, 'utf-8');

      this.manifests.set(filePath, backupPath);
      return true;
    } catch (err) {
      logger.error(`Failed to backup ${filePath}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Restore a single file from backup. */
  restore(filePath: string): boolean {
    const backupPath = this.manifests.get(filePath);
    if (!backupPath) {
      logger.warn(`No backup found for ${filePath}`);
      return false;
    }

    try {
      const content = readFileSync(backupPath, 'utf-8');
      writeFileSync(filePath, content, 'utf-8');
      logger.success(`Restored: ${filePath}`);
      return true;
    } catch (err) {
      logger.error(`Failed to restore ${filePath}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Roll back ALL backed-up files. Used when cleanup encounters errors. */
  restoreAll(): { restored: number; failed: number } {
    let restored = 0;
    let failed = 0;

    for (const [filePath] of this.manifests) {
      if (this.restore(filePath)) restored++;
      else failed++;
    }

    return { restored, failed };
  }

  /** Clean up backup directory after successful cleanup. */
  cleanup(): void {
    try {
      if (existsSync(this.backupDir)) {
        rmSync(this.backupDir, { recursive: true });
      }
    } catch {
      // Non-critical — backup files can be cleaned manually
    }
  }

  get backedUpCount(): number {
    return this.manifests.size;
  }
}
