import { readFileSync, writeFileSync } from 'node:fs';
import * as logger from '../utils/logger.js';

/** Escape special regex characters so module paths like @scope/pkg are matched literally */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove a specific import line from a file.
 * Uses precise regex matching to avoid false positives:
 *   - Python: matches exact module in `from X import` / `import X` with word boundaries
 *   - JS/TS: matches exact quoted string in import/require statements
 */
export function removeImportLine(filePath: string, targetModule: string, dryRun: boolean): boolean {
  if (dryRun) {
    logger.info(`[DRY RUN] Would remove import of '${targetModule}' from ${filePath}`);
    return true;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Escape special regex characters in the target module path
    const escaped = escapeRegex(targetModule);

    // Precise patterns — won't match "utilHelper" when targeting "util"
    const pythonFromPattern = new RegExp(`^\\s*from\\s+${escaped}\\s+import\\b`);
    const pythonImportPattern = new RegExp(
      `^\\s*import\\s+${escaped}\\s*$` +       // import X
      `|^\\s*import\\s+${escaped}\\s*,` +       // import X, Y
      `|^\\s*import\\s+${escaped}\\s+as\\b`     // import X as Y
    );
    const jsQuotedPattern = new RegExp(`['"]${escaped}['"]`);

    const filtered = lines.filter(line => {
      const trimmed = line.trim();

      // Python: from <exact_module> import ...
      if (pythonFromPattern.test(trimmed)) return false;

      // Python: import <exact_module> (with optional alias)
      if (pythonImportPattern.test(trimmed)) return false;

      // JS/TS: only remove if the module appears as an exact quoted string
      if (jsQuotedPattern.test(trimmed)) {
        if (trimmed.startsWith('import ') || trimmed.includes('require(')) return false;
      }

      return true;
    });

    if (filtered.length === lines.length) return false;

    writeFileSync(filePath, filtered.join('\n'), 'utf-8');
    logger.success(`Removed import of '${targetModule}' from ${filePath}`);
    return true;
  } catch (err) {
    logger.error(`Failed to clean imports in ${filePath}: ${(err as Error).message}`);
    return false;
  }
}
