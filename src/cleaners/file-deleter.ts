import { unlinkSync, existsSync, accessSync, constants } from 'node:fs';
import * as logger from '../utils/logger.js';

export function deleteFile(filePath: string, dryRun: boolean): boolean {
  if (dryRun) {
    logger.info(`[DRY RUN] Would delete: ${filePath}`);
    return true;
  }

  // Pre-flight: verify file still exists and is writable
  if (!existsSync(filePath)) {
    logger.warn(`Skipped: ${filePath} no longer exists (already deleted or moved)`);
    return false;
  }

  try {
    accessSync(filePath, constants.W_OK);
  } catch {
    logger.error(`Cannot delete ${filePath}: no write permission`);
    return false;
  }

  try {
    unlinkSync(filePath);
    logger.success(`Deleted: ${filePath}`);
    return true;
  } catch (err) {
    logger.error(`Failed to delete ${filePath}: ${(err as Error).message}`);
    return false;
  }
}
