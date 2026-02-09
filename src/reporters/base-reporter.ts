import type { ScanReport } from '../core/types.js';

export interface ReporterPlugin {
  /** Unique name for this reporter */
  name: string;

  /** Render the scan report */
  render(report: ScanReport): Promise<string>;
}
