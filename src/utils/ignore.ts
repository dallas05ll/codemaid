import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export function loadIgnorePatterns(rootDir: string): string[] {
  const patterns: string[] = [];
  const ignorePath = path.join(rootDir, '.codemaidignore');

  if (!existsSync(ignorePath)) return patterns;

  const content = readFileSync(ignorePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}
