import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ScannerPlugin } from './base-scanner.js';
import type { ScanResult, CodemaidConfig, ExportedSymbol, ImportedSymbol, Issue } from '../core/types.js';
import { resolveJsImport } from '../core/resolver.js';

// Regex patterns for JS/TS imports and exports
const ESM_IMPORT_RE = /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|[\w*]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_NAMED_RE = /export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g;
const EXPORT_DEFAULT_RE = /export\s+default\s+(?:function|class)?\s*(\w+)?/g;

const JS_ENTRY_NAMES = new Set([
  'index.js', 'index.ts', 'index.tsx', 'main.js', 'main.ts',
  'app.js', 'app.ts', 'server.js', 'server.ts', 'cli.js', 'cli.ts',
]);

export class JavaScriptScanner implements ScannerPlugin {
  name = 'javascript';
  extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

  async scan(files: string[], allFiles: string[], config: CodemaidConfig): Promise<ScanResult> {
    const allFileSet = new Set(allFiles);
    const exports: ExportedSymbol[] = [];
    const imports: ImportedSymbol[] = [];
    const issues: Issue[] = [];

    // Collect all imported npm packages across the project for package.json check
    const importedPackages = new Set<string>();

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // Extract named exports
      for (const match of content.matchAll(EXPORT_NAMED_RE)) {
        exports.push({
          name: match[1],
          filePath: file,
          line: lineNumber(content, match.index!),
          kind: match[0].includes('function') ? 'function'
            : match[0].includes('class') ? 'class'
            : match[0].includes('type') || match[0].includes('interface') ? 'type'
            : 'variable',
        });
      }

      // Extract default exports
      for (const match of content.matchAll(EXPORT_DEFAULT_RE)) {
        exports.push({
          name: match[1] || 'default',
          filePath: file,
          line: lineNumber(content, match.index!),
          kind: 'default',
        });
      }

      // Extract all imports (ESM, require, dynamic)
      const importPatterns = [ESM_IMPORT_RE, REQUIRE_RE, DYNAMIC_IMPORT_RE];
      for (const pattern of importPatterns) {
        for (const match of content.matchAll(new RegExp(pattern.source, pattern.flags))) {
          const specifier = match[1];
          const isBarImport = isBareImport(specifier);
          const resolved = isBarImport ? null : resolveJsImport(specifier, file, allFileSet);
          const pkgName = extractPackageName(specifier);
          if (pkgName) importedPackages.add(pkgName);

          imports.push({
            name: specifier,
            fromModule: specifier,
            filePath: file,
            line: lineNumber(content, match.index!),
            // Bare imports (npm packages, node: builtins) are external — not broken
            // Only relative imports that fail to resolve are truly broken
            resolved: isBarImport ? 'external' : (resolved ?? undefined),
          });
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

      // Modularity: too many exports
      const fileExports = exports.filter(e => e.filePath === file);
      if (fileExports.length > config.thresholds.maxExports) {
        issues.push({
          category: 'modularity',
          severity: 'info',
          filePath: file,
          message: `File has ${fileExports.length} exports (threshold: ${config.thresholds.maxExports})`,
          action: 'skip',
        });
      }
    }

    // Check package.json dependencies vs actual imports
    const packageJsonFiles = allFiles.filter(f => path.basename(f) === 'package.json' && !f.includes('node_modules'));
    for (const pkgFile of packageJsonFiles) {
      try {
        const pkgContent = JSON.parse(readFileSync(pkgFile, 'utf-8'));
        const deps = {
          ...pkgContent.dependencies,
          ...pkgContent.devDependencies,
        };

        for (const dep of Object.keys(deps)) {
          // Skip common dev tools that aren't explicitly imported
          if (isDevTool(dep)) continue;

          if (!importedPackages.has(dep)) {
            issues.push({
              category: 'unused-dependency',
              severity: 'warning',
              filePath: pkgFile,
              message: `Package '${dep}' in package.json is not imported in any JS/TS file`,
              action: 'skip',
            });
          }
        }
      } catch {
        // Skip malformed package.json
      }
    }

    return { files, exports, imports, issues };
  }
}

function lineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/** Extract the npm package name from an import specifier */
function extractPackageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  // Scoped packages: @scope/name
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return specifier.split('/')[0];
}

/** Check if an import specifier is a bare import (npm package or node builtin) */
function isBareImport(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/');
}

/** Dev tools that are used via CLI/config rather than imported */
function isDevTool(dep: string): boolean {
  const tools = new Set([
    'typescript', 'tsup', 'vitest', 'jest', 'mocha', 'eslint', 'prettier',
    'husky', 'lint-staged', '@types/', 'ts-node', 'nodemon', 'concurrently',
  ]);
  return tools.has(dep) || dep.startsWith('@types/');
}
