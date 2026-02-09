import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, type CodemaidConfig } from './types.js';
import { loadIgnorePatterns } from '../utils/ignore.js';
import * as logger from '../utils/logger.js';

/** Validate a parsed config object, returning an array of error messages. */
function validateConfig(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (raw.include !== undefined && !Array.isArray(raw.include)) {
    errors.push('"include" must be an array of glob strings');
  }
  if (raw.exclude !== undefined && !Array.isArray(raw.exclude)) {
    errors.push('"exclude" must be an array of glob strings');
  }
  if (raw.entryPoints !== undefined && !Array.isArray(raw.entryPoints)) {
    errors.push('"entryPoints" must be an array of file paths');
  }
  if (raw.scanners !== undefined && typeof raw.scanners !== 'object') {
    errors.push('"scanners" must be an object with boolean values');
  }
  if (raw.thresholds !== undefined) {
    const t = raw.thresholds as Record<string, unknown>;
    if (typeof t !== 'object') {
      errors.push('"thresholds" must be an object');
    } else {
      if (t.maxFileLines !== undefined && (typeof t.maxFileLines !== 'number' || t.maxFileLines < 1)) {
        errors.push('"thresholds.maxFileLines" must be a positive number');
      }
      if (t.maxExports !== undefined && (typeof t.maxExports !== 'number' || t.maxExports < 1)) {
        errors.push('"thresholds.maxExports" must be a positive number');
      }
    }
  }

  return errors;
}

export function loadConfig(rootDir: string, overrides: Partial<CodemaidConfig> = {}): CodemaidConfig {
  const configPath = path.join(rootDir, '.codemaidrc.json');
  let fileConfig: Partial<CodemaidConfig> = {};

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf-8');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      logger.error(`Invalid JSON in ${configPath}: ${(err as Error).message}`);
      logger.warn('Falling back to default config');
      parsed = {};
    }

    const errors = validateConfig(parsed);
    if (errors.length > 0) {
      for (const e of errors) logger.warn(`Config: ${e}`);
      logger.warn('Invalid fields will be ignored, defaults used instead');
    }

    fileConfig = parsed as Partial<CodemaidConfig>;
  }

  const ignorePatterns = loadIgnorePatterns(rootDir);

  const config: CodemaidConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...overrides,
    rootDir: path.resolve(rootDir),
    scanners: {
      ...DEFAULT_CONFIG.scanners,
      ...fileConfig.scanners,
      ...overrides.scanners,
    },
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...fileConfig.thresholds,
      ...overrides.thresholds,
    },
    ignorePatterns: [
      ...DEFAULT_CONFIG.ignorePatterns,
      ...ignorePatterns,
      ...(fileConfig.ignorePatterns ?? []),
      ...(overrides.ignorePatterns ?? []),
    ],
  };

  return config;
}

export function generateDefaultConfig(): string {
  const config = {
    include: DEFAULT_CONFIG.include,
    exclude: DEFAULT_CONFIG.exclude,
    scanners: DEFAULT_CONFIG.scanners,
    thresholds: DEFAULT_CONFIG.thresholds,
  };
  return JSON.stringify(config, null, 2);
}
