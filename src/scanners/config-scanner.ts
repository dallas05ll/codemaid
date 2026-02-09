import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { ScannerPlugin } from './base-scanner.js';
import type { ScanResult, CodemaidConfig, ExportedSymbol, ImportedSymbol, Issue } from '../core/types.js';

export class ConfigScanner implements ScannerPlugin {
  name = 'config';
  extensions = ['.yml', '.yaml', '.env', '.json'];

  async scan(files: string[], allFiles: string[], config: CodemaidConfig): Promise<ScanResult> {
    const allFileSet = new Set(allFiles);
    const exports: ExportedSymbol[] = [];
    const imports: ImportedSymbol[] = [];
    const issues: Issue[] = [];

    for (const file of files) {
      const basename = path.basename(file);

      if (basename === 'docker-compose.yml' || basename === 'docker-compose.yaml') {
        this.scanDockerCompose(file, config.rootDir, allFileSet, issues);
      }

      if (basename === '.env.example') {
        this.scanEnvExample(file, allFiles, issues);
      }
    }

    return { files, exports, imports, issues };
  }

  private scanDockerCompose(file: string, rootDir: string, allFiles: Set<string>, issues: Issue[]): void {
    try {
      const content = readFileSync(file, 'utf-8');
      const doc = yaml.load(content) as Record<string, unknown>;
      const services = (doc as { services?: Record<string, unknown> }).services;
      if (!services || typeof services !== 'object') return;

      for (const [serviceName, serviceConfig] of Object.entries(services)) {
        const svc = serviceConfig as Record<string, unknown>;
        // Check if build context directory exists
        if (svc.build) {
          const buildCtx = typeof svc.build === 'string'
            ? svc.build
            : (svc.build as Record<string, string>).context;

          if (buildCtx) {
            const buildDir = path.resolve(path.dirname(file), buildCtx);
            // Check if any file exists under this directory
            let hasFiles = false;
            for (const f of allFiles) {
              if (f.startsWith(buildDir)) { hasFiles = true; break; }
            }
            if (!hasFiles) {
              issues.push({
                category: 'stale-reference',
                severity: 'warning',
                filePath: file,
                message: `Service '${serviceName}' references build context '${buildCtx}' but directory has no files`,
                action: 'skip',
              });
            }
          }
        }
      }
    } catch {
      // Skip malformed YAML
    }
  }

  private scanEnvExample(file: string, allFiles: string[], issues: Issue[]): void {
    const content = readFileSync(file, 'utf-8');
    const envKeys: string[] = [];

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const key = trimmed.split('=')[0].trim();
      if (key) envKeys.push(key);
    }

    // Check if env keys are referenced in Python or JS config files
    const configFiles = allFiles.filter(f =>
      f.endsWith('config.py') || f.endsWith('config.ts') || f.endsWith('config.js') ||
      f.endsWith('.env') || f.includes('settings')
    );

    const allConfigContent = configFiles.map(f => {
      try { return readFileSync(f, 'utf-8'); } catch { return ''; }
    }).join('\n');

    for (const key of envKeys) {
      if (!allConfigContent.includes(key)) {
        issues.push({
          category: 'stale-reference',
          severity: 'info',
          filePath: file,
          message: `Environment variable '${key}' in .env.example is not referenced in any config file`,
          action: 'skip',
        });
      }
    }
  }
}
