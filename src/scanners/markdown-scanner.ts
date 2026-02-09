import { readFileSync } from 'node:fs';
import type { ScannerPlugin } from './base-scanner.js';
import type { ScanResult, CodemaidConfig, ExportedSymbol, ImportedSymbol, Issue } from '../core/types.js';
import { resolveRelativePath } from '../core/resolver.js';

// Markdown link: [text](path) — skip URLs, anchors, and mailto
const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export class MarkdownScanner implements ScannerPlugin {
  name = 'markdown';
  extensions = ['.md', '.mdx'];

  async scan(files: string[], allFiles: string[], config: CodemaidConfig): Promise<ScanResult> {
    const exports: ExportedSymbol[] = [];
    const imports: ImportedSymbol[] = [];
    const issues: Issue[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');

      for (const match of content.matchAll(MD_LINK_RE)) {
        const linkText = match[1];
        const linkPath = match[2];

        // Skip external URLs, anchors, and mailto
        if (linkPath.startsWith('http://') || linkPath.startsWith('https://') ||
            linkPath.startsWith('#') || linkPath.startsWith('mailto:')) {
          continue;
        }

        // Strip anchor from path: "file.md#section" → "file.md"
        const cleanPath = linkPath.split('#')[0];
        if (!cleanPath) continue;

        const resolved = resolveRelativePath(cleanPath, file);
        const line = lineNumber(content, match.index!);

        imports.push({
          name: linkText,
          fromModule: cleanPath,
          filePath: file,
          line,
          resolved: resolved ?? undefined,
        });

        if (!resolved) {
          issues.push({
            category: 'doc-drift',
            severity: 'error',
            filePath: file,
            line,
            message: `Link [${linkText}](${linkPath}) points to non-existent file`,
            action: 'update',
            fix: {
              type: 'remove-link',
              target: match[0],
            },
          });
        }
      }
    }

    return { files, exports, imports, issues };
  }
}

function lineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}
