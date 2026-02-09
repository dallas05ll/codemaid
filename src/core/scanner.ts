import path from 'node:path';
import type { ScannerPlugin } from '../scanners/base-scanner.js';
import type { CodemaidConfig, ScanReport, Issue, IssueConfidence } from './types.js';
import { KNOWN_ENTRY_POINTS as ENTRY_POINTS } from './types.js';
import { DependencyGraph } from './graph.js';
import { discoverFiles, filterByExtensions } from '../utils/file-discovery.js';
import { PythonScanner } from '../scanners/python-scanner.js';
import { JavaScriptScanner } from '../scanners/javascript-scanner.js';
import { MarkdownScanner } from '../scanners/markdown-scanner.js';
import { ConfigScanner } from '../scanners/config-scanner.js';
import { CssScanner } from '../scanners/css-scanner.js';
import * as logger from '../utils/logger.js';
import * as progress from '../utils/progress.js';

export class ScanOrchestrator {
  private plugins: ScannerPlugin[] = [];
  private graph = new DependencyGraph();

  constructor(config: CodemaidConfig) {
    if (config.scanners.python) this.plugins.push(new PythonScanner());
    if (config.scanners.javascript) this.plugins.push(new JavaScriptScanner());
    if (config.scanners.markdown) this.plugins.push(new MarkdownScanner());
    if (config.scanners.config) this.plugins.push(new ConfigScanner());
    if (config.scanners.css) this.plugins.push(new CssScanner());
  }

  async scan(config: CodemaidConfig, only?: string): Promise<ScanReport> {
    const startTime = Date.now();

    // Step 1: Discover all files
    progress.start('Discovering files...');
    const allFiles = await discoverFiles(config);
    progress.succeed(`Found ${allFiles.length} files`);

    // Filter plugins if --only flag is used
    let activePlugins = this.plugins;
    if (only) {
      const map: Record<string, string[]> = {
        python: ['python'],
        py: ['python'],
        javascript: ['javascript'],
        js: ['javascript'],
        ts: ['javascript'],
        docs: ['markdown'],
        markdown: ['markdown'],
        md: ['markdown'],
        css: ['css'],
        config: ['config'],
      };
      const names = map[only] ?? [only];
      activePlugins = this.plugins.filter(p => names.includes(p.name));
    }

    // Step 2: Run each scanner plugin
    const allIssues: Issue[] = [];

    for (const plugin of activePlugins) {
      progress.start(`Scanning ${plugin.name} files...`);
      const pluginFiles = filterByExtensions(allFiles, plugin.extensions);

      if (pluginFiles.length === 0) {
        progress.succeed(`No ${plugin.name} files found`);
        continue;
      }

      const result = await plugin.scan(pluginFiles, allFiles, config);

      // Add to graph
      for (const file of result.files) {
        this.graph.addFile(file);
      }
      for (const exp of result.exports) {
        this.graph.addExport(exp.filePath, exp);
      }
      for (const imp of result.imports) {
        this.graph.addImport(imp.filePath, imp);
        if (imp.resolved) {
          this.graph.addEdge(imp.filePath, imp.resolved);
        }
      }

      allIssues.push(...result.issues);
      progress.succeed(`Scanned ${pluginFiles.length} ${plugin.name} files`);
    }

    // Step 3: Detect entry points
    progress.start('Analyzing dependency graph...');
    const entryPointNames = new Set(ENTRY_POINTS);

    // Auto-detect entry points by filename
    for (const file of allFiles) {
      const basename = path.basename(file);
      if (entryPointNames.has(basename)) {
        this.graph.markEntryPoint(file);
      }
    }

    // User-configured entry points
    for (const ep of config.entryPoints) {
      const resolved = path.resolve(config.rootDir, ep);
      this.graph.markEntryPoint(resolved);
    }

    // Step 4: Find orphaned files (only for code files, not docs/config)
    const codeExtensions = new Set(['.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
    const orphaned = this.graph.getOrphanedFiles().filter(f => {
      const ext = path.extname(f);
      return codeExtensions.has(ext);
    });

    for (const file of orphaned) {
      allIssues.push({
        category: 'dead-file',
        severity: 'warning',
        filePath: file,
        message: 'File is not imported by any other file and not an entry point',
        action: 'delete',
      });
    }

    // Step 5: Find broken imports
    const brokenImports = this.graph.getBrokenImports();
    allIssues.push(...brokenImports);

    // Step 6: Detect unused exports — Strategy B (layered with confidence)
    // Reports ALL unused exports tagged with confidence so agents get full data
    // and humans see severity-based filtering in console output.
    const rawUnused = this.graph.getUnusedExports();

    for (const { filePath, symbol, totalExports } of rawUnused) {
      const basename = path.basename(filePath);
      const trace = this.graph.traceRoute(filePath);

      // Assign confidence based on context
      let confidence: IssueConfidence = 'high';
      let reason = `Export '${symbol.name}' is not imported by any other file in the project`;

      // Barrel files: low confidence — they re-export by design
      if (/^index\.[jt]sx?$/.test(basename)) {
        confidence = 'low';
        reason = `Barrel file — re-exports are intentional API surface`;
      }
      // Test files: low confidence — test helpers aren't production imports
      else if (/\.(test|spec)\.[jt]sx?$/.test(basename) || /\/__tests__\//.test(filePath) || /\/tests?\//.test(filePath)) {
        confidence = 'low';
        reason = `Test helper — not expected to be imported by production code`;
      }
      // Type-only exports: medium confidence — may be consumed indirectly
      else if (symbol.kind === 'type') {
        confidence = 'medium';
        reason = `Type export '${symbol.name}' may be consumed via declaration merging or inference`;
      }
      // File has only one export and it's unused: high — whole file likely dead
      else if (totalExports === 1) {
        confidence = 'high';
        reason = `Only export in this file — the entire file may be dead code`;
      }

      // Severity maps from confidence: high→warning, medium→info, low→info
      const severity = confidence === 'high' ? 'warning' : 'info';

      allIssues.push({
        category: 'unused-export',
        severity,
        filePath,
        line: symbol.line,
        message: `Export '${symbol.name}' (${symbol.kind}) is never imported`,
        action: 'skip',
        confidence,
        reason,
        trace: trace.length > 0 ? trace : undefined,
      });
    }

    const graphStats = this.graph.getStats();
    progress.succeed(`Graph: ${graphStats.totalFiles} files, ${graphStats.totalEdges} edges, ${graphStats.entryPoints} entry points`);

    // Build report
    const duration = Date.now() - startTime;
    const report: ScanReport = {
      timestamp: new Date().toISOString(),
      rootDir: config.rootDir,
      duration,
      scanners: activePlugins.map(p => p.name),
      issues: allIssues,
      stats: {
        filesScanned: allFiles.length,
        deadFiles: allIssues.filter(i => i.category === 'dead-file').length,
        staleRefs: allIssues.filter(i => i.category === 'stale-reference').length,
        unusedDeps: allIssues.filter(i => i.category === 'unused-dependency').length,
        unusedExports: allIssues.filter(i => i.category === 'unused-export').length,
        docDrift: allIssues.filter(i => i.category === 'doc-drift').length,
        modularityIssues: allIssues.filter(i => i.category === 'modularity').length,
      },
    };

    return report;
  }
}
