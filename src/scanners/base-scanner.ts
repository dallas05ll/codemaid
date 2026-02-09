import type { ScanResult, CodemaidConfig } from '../core/types.js';

export interface ScannerPlugin {
  /** Unique name for this scanner (e.g., 'python', 'javascript') */
  name: string;

  /** File extensions this scanner handles */
  extensions: string[];

  /** Run the scanner against discovered files */
  scan(files: string[], allFiles: string[], config: CodemaidConfig): Promise<ScanResult>;
}
