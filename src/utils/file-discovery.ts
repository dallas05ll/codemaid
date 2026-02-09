import fg from 'fast-glob';
import type { CodemaidConfig } from '../core/types.js';

export async function discoverFiles(config: CodemaidConfig): Promise<string[]> {
  const ignore = [...config.exclude, ...config.ignorePatterns];

  const files = await fg(config.include, {
    cwd: config.rootDir,
    ignore,
    absolute: true,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  return files.sort();
}

export function filterByExtensions(files: string[], extensions: string[]): string[] {
  const extSet = new Set(extensions.map(e => e.startsWith('.') ? e : `.${e}`));
  return files.filter(f => {
    const ext = f.slice(f.lastIndexOf('.'));
    return extSet.has(ext);
  });
}
