import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateDefaultConfig } from '../core/config.js';
import * as logger from '../utils/logger.js';

export async function runInit(rootDir: string): Promise<void> {
  const configPath = path.join(rootDir, '.codemaidrc.json');

  if (existsSync(configPath)) {
    logger.warn('.codemaidrc.json already exists. Use --force to overwrite.');
    return;
  }

  const content = generateDefaultConfig();
  writeFileSync(configPath, content + '\n', 'utf-8');
  logger.success(`Created ${configPath}`);
  logger.info('Edit this file to customize scanning behavior.');
}
