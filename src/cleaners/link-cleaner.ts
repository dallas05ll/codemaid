import { readFileSync, writeFileSync } from 'node:fs';
import * as logger from '../utils/logger.js';

/**
 * Remove a specific broken markdown link, replacing it with its display text.
 * Uses indexOf to replace only the FIRST occurrence, preventing accidental
 * removal of duplicate links elsewhere in the file.
 */
export function removeBrokenLink(filePath: string, linkMarkdown: string, dryRun: boolean): boolean {
  if (dryRun) {
    logger.info(`[DRY RUN] Would remove broken link from ${filePath}`);
    return true;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const linkTextMatch = linkMarkdown.match(/\[([^\]]*)\]/);
    const replacement = linkTextMatch ? linkTextMatch[1] : '';

    // Replace only the FIRST occurrence to avoid clobbering duplicate links
    const idx = content.indexOf(linkMarkdown);
    if (idx === -1) return false;

    const updated =
      content.slice(0, idx) +
      replacement +
      content.slice(idx + linkMarkdown.length);

    writeFileSync(filePath, updated, 'utf-8');
    logger.success(`Fixed broken link in ${filePath}`);
    return true;
  } catch (err) {
    logger.error(`Failed to clean link in ${filePath}: ${(err as Error).message}`);
    return false;
  }
}
