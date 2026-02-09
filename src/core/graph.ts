import type { ExportedSymbol, ImportedSymbol, Issue } from './types.js';

interface FileNode {
  filePath: string;
  exports: ExportedSymbol[];
  imports: ImportedSymbol[];
  /** Files this file imports from */
  dependsOn: Set<string>;
  /** Files that import from this file */
  dependedBy: Set<string>;
}

export class DependencyGraph {
  private nodes = new Map<string, FileNode>();
  private entryPoints = new Set<string>();

  addFile(filePath: string): void {
    if (!this.nodes.has(filePath)) {
      this.nodes.set(filePath, {
        filePath,
        exports: [],
        imports: [],
        dependsOn: new Set(),
        dependedBy: new Set(),
      });
    }
  }

  addExport(filePath: string, symbol: ExportedSymbol): void {
    this.ensureNode(filePath);
    this.nodes.get(filePath)!.exports.push(symbol);
  }

  addImport(filePath: string, symbol: ImportedSymbol): void {
    this.ensureNode(filePath);
    this.nodes.get(filePath)!.imports.push(symbol);
  }

  addEdge(fromFile: string, toFile: string): void {
    this.ensureNode(fromFile);
    this.ensureNode(toFile);
    this.nodes.get(fromFile)!.dependsOn.add(toFile);
    this.nodes.get(toFile)!.dependedBy.add(fromFile);
  }

  markEntryPoint(filePath: string): void {
    this.entryPoints.add(filePath);
  }

  /**
   * BFS: Flood-fill from all entry points to find every reachable file.
   * Any file NOT in the visited set is orphaned (dead code).
   */
  getOrphanedFiles(): string[] {
    // BFS — use a queue to walk all reachable files from entry points
    const visited = new Set<string>();
    const queue: string[] = [...this.entryPoints];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      // Follow every import edge to the next file
      for (const dep of node.dependsOn) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    // Anything in the graph but NOT visited = orphaned
    const orphaned: string[] = [];
    for (const filePath of this.nodes.keys()) {
      if (!visited.has(filePath)) {
        orphaned.push(filePath);
      }
    }
    return orphaned;
  }

  /**
   * DFS: Trace the exact import route from an entry point to a target file.
   * Returns the path like ['main.py', 'auth.py', 'database.py'] or [] if unreachable.
   * Used by the reporter to show HOW a file is connected.
   */
  traceRoute(target: string): string[] {
    for (const entry of this.entryPoints) {
      const path = this.dfsTrace(entry, target, new Set());
      if (path.length > 0) return path;
    }
    return []; // unreachable from any entry point
  }

  private dfsTrace(current: string, target: string, visited: Set<string>): string[] {
    if (current === target) return [current];
    if (visited.has(current)) return [];
    visited.add(current);

    const node = this.nodes.get(current);
    if (!node) return [];

    // Go deep: follow each dependency edge recursively
    for (const dep of node.dependsOn) {
      const route = this.dfsTrace(dep, target, visited);
      if (route.length > 0) {
        return [current, ...route];
      }
    }
    return [];
  }

  getBrokenImports(): Issue[] {
    const issues: Issue[] = [];
    for (const [filePath, node] of this.nodes) {
      for (const imp of node.imports) {
        if (imp.resolved === undefined) {
          issues.push({
            category: 'stale-reference',
            severity: 'error',
            filePath,
            line: imp.line,
            message: `Import '${imp.name}' from '${imp.fromModule}' cannot be resolved`,
            action: 'update',
            fix: {
              type: 'remove-import',
              target: imp.fromModule,
            },
          });
        }
      }
    }
    return issues;
  }

  /** Returns unused exports with their symbol kind for confidence tagging */
  getUnusedExports(): Array<{ filePath: string; symbol: ExportedSymbol; totalExports: number }> {
    const results: Array<{ filePath: string; symbol: ExportedSymbol; totalExports: number }> = [];
    for (const [filePath, node] of this.nodes) {
      if (this.entryPoints.has(filePath)) continue;

      for (const exp of node.exports) {
        const isUsed = this.isExportUsed(filePath, exp.name);
        if (!isUsed) {
          results.push({ filePath, symbol: exp, totalExports: node.exports.length });
        }
      }
    }
    return results;
  }

  getStats(): { totalFiles: number; totalEdges: number; entryPoints: number } {
    let totalEdges = 0;
    for (const node of this.nodes.values()) {
      totalEdges += node.dependsOn.size;
    }
    return {
      totalFiles: this.nodes.size,
      totalEdges,
      entryPoints: this.entryPoints.size,
    };
  }

  private ensureNode(filePath: string): void {
    if (!this.nodes.has(filePath)) this.addFile(filePath);
  }

  private isExportUsed(filePath: string, exportName: string): boolean {
    for (const node of this.nodes.values()) {
      if (node.filePath === filePath) continue;
      for (const imp of node.imports) {
        if (imp.resolved === filePath && (imp.name === exportName || imp.name === '*')) {
          return true;
        }
      }
    }
    return false;
  }
}
