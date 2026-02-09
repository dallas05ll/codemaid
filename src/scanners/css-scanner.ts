import { readFileSync } from 'node:fs';
import type { ScannerPlugin } from './base-scanner.js';
import type { ScanResult, CodemaidConfig, ExportedSymbol, ImportedSymbol, Issue } from '../core/types.js';

// Match CSS class definitions: .className {
const CSS_CLASS_RE = /\.([a-zA-Z_][\w-]*)\s*[{,:\s]/g;
// Match className references in JS/JSX/TSX
const CLASSNAME_RE = /className\s*=\s*[{"]([^}"]+)/g;
const CLASS_ATTR_RE = /class\s*=\s*["']([^"']+)/g;

export class CssScanner implements ScannerPlugin {
  name = 'css';
  extensions = ['.css'];

  async scan(files: string[], allFiles: string[], config: CodemaidConfig): Promise<ScanResult> {
    const exports: ExportedSymbol[] = [];
    const imports: ImportedSymbol[] = [];
    const issues: Issue[] = [];

    // Collect all class names used in JS/JSX/TSX/HTML files
    const usedClasses = new Set<string>();
    const jsFiles = allFiles.filter(f =>
      f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.tsx') || f.endsWith('.html')
    );

    for (const jsFile of jsFiles) {
      try {
        const content = readFileSync(jsFile, 'utf-8');
        for (const match of content.matchAll(CLASSNAME_RE)) {
          for (const cls of match[1].split(/\s+/)) {
            if (cls.trim()) usedClasses.add(cls.trim());
          }
        }
        for (const match of content.matchAll(CLASS_ATTR_RE)) {
          for (const cls of match[1].split(/\s+/)) {
            if (cls.trim()) usedClasses.add(cls.trim());
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Check each CSS file for unused class definitions
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const definedClasses = new Set<string>();

      for (const match of content.matchAll(CSS_CLASS_RE)) {
        definedClasses.add(match[1]);
      }

      for (const cls of definedClasses) {
        exports.push({
          name: cls,
          filePath: file,
          kind: 'variable',
        });

        if (!usedClasses.has(cls)) {
          issues.push({
            category: 'dead-file',
            severity: 'info',
            filePath: file,
            message: `CSS class '.${cls}' is defined but never referenced in any JS/HTML file`,
            action: 'skip',
          });
        }
      }
    }

    return { files, exports, imports, issues };
  }
}
