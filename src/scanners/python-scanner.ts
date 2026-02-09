import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ScannerPlugin } from './base-scanner.js';
import type { ScanResult, CodemaidConfig, ExportedSymbol, ImportedSymbol, Issue } from '../core/types.js';
import { resolvePythonImport } from '../core/resolver.js';

// Regex patterns for Python imports
const IMPORT_RE = /^import\s+([\w.]+)/gm;
const FROM_IMPORT_RE = /^from\s+([\w.]+)\s+import\s+(.+)/gm;
const DEF_RE = /^(?:def|class)\s+(\w+)/gm;
const ALL_RE = /__all__\s*=\s*\[([^\]]*)\]/s;

const PY_ENTRY_NAMES = new Set([
  'main.py', 'app.py', 'server.py', 'wsgi.py', 'asgi.py',
  'manage.py', 'cli.py', '__main__.py', 'setup.py',
]);

export class PythonScanner implements ScannerPlugin {
  name = 'python';
  extensions = ['.py'];

  async scan(files: string[], allFiles: string[], config: CodemaidConfig): Promise<ScanResult> {
    const allFileSet = new Set(allFiles);
    const exports: ExportedSymbol[] = [];
    const imports: ImportedSymbol[] = [];
    const issues: Issue[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // Extract exports (def/class at top level)
      for (const match of content.matchAll(DEF_RE)) {
        exports.push({
          name: match[1],
          filePath: file,
          line: lineNumber(content, match.index!),
          kind: match[0].startsWith('class') ? 'class' : 'function',
        });
      }

      // Extract imports: `import X`
      for (const match of content.matchAll(IMPORT_RE)) {
        const modulePath = match[1];
        const resolved = resolvePythonImport(modulePath, config.rootDir, allFileSet);
        imports.push({
          name: modulePath.split('.').pop()!,
          fromModule: modulePath,
          filePath: file,
          line: lineNumber(content, match.index!),
          // If it doesn't resolve to a local file, it's a stdlib/pip package — not broken
          resolved: resolved ?? 'external',
        });
      }

      // Extract imports: `from X import Y, Z`
      for (const match of content.matchAll(FROM_IMPORT_RE)) {
        const modulePath = match[1];
        const names = match[2].split(',').map(n => n.trim().split(' as ')[0].trim());
        const resolved = resolvePythonImport(modulePath, config.rootDir, allFileSet);

        for (const name of names) {
          if (name === '(' || name === ')' || name === '\\') continue;
          imports.push({
            name,
            fromModule: modulePath,
            filePath: file,
            line: lineNumber(content, match.index!),
            resolved: resolved ?? 'external',
          });
        }
      }

      // Check __init__.py: compare __all__ exports vs actual files in directory
      if (path.basename(file) === '__init__.py') {
        const allMatch = content.match(ALL_RE);
        if (allMatch) {
          const exportedNames = allMatch[1]
            .split(',')
            .map(s => s.trim().replace(/['"]/g, ''))
            .filter(Boolean);

          const dir = path.dirname(file);
          for (const name of exportedNames) {
            const expectedFile = path.join(dir, `${name}.py`);
            if (!allFileSet.has(expectedFile)) {
              issues.push({
                category: 'stale-reference',
                severity: 'error',
                filePath: file,
                message: `__all__ exports '${name}' but ${name}.py does not exist in ${dir}`,
                action: 'update',
                fix: { type: 'remove-import', target: name },
              });
            }
          }
        }
      }

      // Check requirements.txt references
      if (path.basename(file) === 'requirements.txt') {
        const allPyFiles = files.filter(f => f.endsWith('.py'));
        const allImportedModules = new Set<string>();

        for (const pyFile of allPyFiles) {
          const pyContent = readFileSync(pyFile, 'utf-8');
          for (const m of pyContent.matchAll(IMPORT_RE)) allImportedModules.add(m[1].split('.')[0]);
          for (const m of pyContent.matchAll(FROM_IMPORT_RE)) allImportedModules.add(m[1].split('.')[0]);
        }

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
          const pkg = trimmed.split(/[><=!~\[]/)[0].trim().replace(/-/g, '_').toLowerCase();
          if (pkg && !allImportedModules.has(pkg) && !allImportedModules.has(pkg.replace(/_/g, ''))) {
            issues.push({
              category: 'unused-dependency',
              severity: 'warning',
              filePath: file,
              message: `Package '${trimmed.split(/[><=!~\[]/)[0].trim()}' in requirements.txt is not imported in any Python file`,
              action: 'skip',
            });
          }
        }
      }

      // Modularity: large files
      if (lines.length > config.thresholds.maxFileLines) {
        issues.push({
          category: 'modularity',
          severity: 'info',
          filePath: file,
          message: `File has ${lines.length} lines (threshold: ${config.thresholds.maxFileLines})`,
          action: 'skip',
        });
      }
    }

    return { files, exports, imports, issues };
  }
}

function lineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}
