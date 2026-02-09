export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCategory =
  | 'dead-file'
  | 'stale-reference'
  | 'unused-dependency'
  | 'unused-export'
  | 'doc-drift'
  | 'modularity';

export type IssueConfidence = 'high' | 'medium' | 'low';

export interface Issue {
  category: IssueCategory;
  severity: IssueSeverity;
  filePath: string;
  line?: number;
  message: string;
  suggestion?: string;
  /** What action to take: delete the file, update it, or just advise */
  action: 'delete' | 'update' | 'skip';
  /** For 'update' actions, details about what to change */
  fix?: {
    type: 'remove-import' | 'remove-link' | 'remove-dependency' | 'custom';
    target: string;
    replacement?: string;
  };
  /** How confident the detection is (high/medium/low). Used by agents to prioritize. */
  confidence?: IssueConfidence;
  /** Why this was flagged — human-readable explanation */
  reason?: string;
  /** Dependency trace: how this file connects to entry points (for agent mode) */
  trace?: string[];
}

export interface ScanResult {
  files: string[];
  exports: ExportedSymbol[];
  imports: ImportedSymbol[];
  issues: Issue[];
}

export interface ScanReport {
  timestamp: string;
  rootDir: string;
  duration: number;
  scanners: string[];
  issues: Issue[];
  stats: {
    filesScanned: number;
    deadFiles: number;
    staleRefs: number;
    unusedDeps: number;
    docDrift: number;
    modularityIssues: number;
    unusedExports: number;
  };
}

export interface ExportedSymbol {
  name: string;
  filePath: string;
  line?: number;
  kind: 'function' | 'class' | 'variable' | 'type' | 'default' | 'module';
}

export interface ImportedSymbol {
  name: string;
  fromModule: string;
  filePath: string;
  line?: number;
  resolved?: string;
}

/** Common entry point file names, auto-detected by scanners */
export const KNOWN_ENTRY_POINTS = [
  // Python
  'main.py', 'app.py', 'server.py', 'wsgi.py', 'asgi.py',
  'manage.py', 'cli.py', '__main__.py', 'setup.py',
  // JavaScript/TypeScript
  'index.js', 'index.ts', 'index.tsx', 'main.js', 'main.ts',
  'app.js', 'app.ts', 'server.js', 'server.ts',
  'cli.js', 'cli.ts',
];

export interface CodemaidConfig {
  rootDir: string;
  include: string[];
  exclude: string[];
  /** User-specified entry points (in addition to auto-detected ones) */
  entryPoints: string[];
  scanners: {
    python: boolean;
    javascript: boolean;
    markdown: boolean;
    config: boolean;
    css: boolean;
  };
  thresholds: {
    maxFileLines: number;
    maxExports: number;
  };
  ignorePatterns: string[];
}

export const DEFAULT_CONFIG: CodemaidConfig = {
  rootDir: '.',
  include: ['**/*'],
  entryPoints: [],
  exclude: [
    '**/node_modules/**',
    '**/.venv/**',
    '**/__pycache__/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.map',
  ],
  scanners: {
    python: true,
    javascript: true,
    markdown: true,
    config: true,
    css: true,
  },
  thresholds: {
    maxFileLines: 500,
    maxExports: 10,
  },
  ignorePatterns: [],
};
