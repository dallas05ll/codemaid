import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../../src/core/graph.js';

describe('DependencyGraph', () => {
  it('should detect orphaned files via BFS', () => {
    const graph = new DependencyGraph();

    graph.addFile('/project/main.py');
    graph.addFile('/project/auth.py');
    graph.addFile('/project/database.py');
    graph.addFile('/project/orphan.py');
    graph.addFile('/project/dead.py');

    graph.markEntryPoint('/project/main.py');
    graph.addEdge('/project/main.py', '/project/auth.py');
    graph.addEdge('/project/auth.py', '/project/database.py');

    const orphaned = graph.getOrphanedFiles();

    expect(orphaned).toContain('/project/orphan.py');
    expect(orphaned).toContain('/project/dead.py');
    expect(orphaned).not.toContain('/project/main.py');
    expect(orphaned).not.toContain('/project/auth.py');
    expect(orphaned).not.toContain('/project/database.py');
  });

  it('should handle multiple entry points', () => {
    const graph = new DependencyGraph();

    graph.addFile('/project/api.py');
    graph.addFile('/project/worker.py');
    graph.addFile('/project/shared.py');
    graph.addFile('/project/orphan.py');

    graph.markEntryPoint('/project/api.py');
    graph.markEntryPoint('/project/worker.py');
    graph.addEdge('/project/api.py', '/project/shared.py');
    graph.addEdge('/project/worker.py', '/project/shared.py');

    const orphaned = graph.getOrphanedFiles();

    expect(orphaned).toEqual(['/project/orphan.py']);
  });

  it('should return empty array when no orphans', () => {
    const graph = new DependencyGraph();

    graph.addFile('/project/main.py');
    graph.addFile('/project/utils.py');

    graph.markEntryPoint('/project/main.py');
    graph.addEdge('/project/main.py', '/project/utils.py');

    expect(graph.getOrphanedFiles()).toEqual([]);
  });

  it('should trace route via DFS', () => {
    const graph = new DependencyGraph();

    graph.addFile('/project/main.py');
    graph.addFile('/project/auth.py');
    graph.addFile('/project/db.py');

    graph.markEntryPoint('/project/main.py');
    graph.addEdge('/project/main.py', '/project/auth.py');
    graph.addEdge('/project/auth.py', '/project/db.py');

    const route = graph.traceRoute('/project/db.py');
    expect(route).toEqual(['/project/main.py', '/project/auth.py', '/project/db.py']);
  });

  it('should return empty route for orphaned files', () => {
    const graph = new DependencyGraph();

    graph.addFile('/project/main.py');
    graph.addFile('/project/orphan.py');

    graph.markEntryPoint('/project/main.py');

    expect(graph.traceRoute('/project/orphan.py')).toEqual([]);
  });

  it('should detect broken imports', () => {
    const graph = new DependencyGraph();

    graph.addFile('/project/main.py');
    graph.addImport('/project/main.py', {
      name: 'missing',
      fromModule: './missing',
      filePath: '/project/main.py',
      line: 1,
      resolved: undefined,
    });

    const broken = graph.getBrokenImports();
    expect(broken).toHaveLength(1);
    expect(broken[0].category).toBe('stale-reference');
  });

  it('should report graph stats', () => {
    const graph = new DependencyGraph();

    graph.addFile('/a');
    graph.addFile('/b');
    graph.addFile('/c');
    graph.markEntryPoint('/a');
    graph.addEdge('/a', '/b');
    graph.addEdge('/b', '/c');

    const stats = graph.getStats();
    expect(stats.totalFiles).toBe(3);
    expect(stats.totalEdges).toBe(2);
    expect(stats.entryPoints).toBe(1);
  });
});
