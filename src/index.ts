// Programmatic API for CodeMaid
export { ScanOrchestrator } from './core/scanner.js';
export { DependencyGraph } from './core/graph.js';
export { BackupManager } from './core/backup.js';
export { loadConfig, generateDefaultConfig } from './core/config.js';
export { discoverFiles, filterByExtensions } from './utils/file-discovery.js';
export { ConsoleReporter } from './reporters/console-reporter.js';
export { JsonReporter } from './reporters/json-reporter.js';

// Types
export type {
  Issue,
  IssueCategory,
  IssueConfidence,
  IssueSeverity,
  ScanResult,
  ScanReport,
  ExportedSymbol,
  ImportedSymbol,
  CodemaidConfig,
} from './core/types.js';

export type { ScannerPlugin } from './scanners/base-scanner.js';
export type { ReporterPlugin } from './reporters/base-reporter.js';
