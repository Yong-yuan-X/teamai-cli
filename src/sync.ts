import { push } from './push.js';
import { pull } from './pull.js';
import { log } from './utils/logger.js';
import type { GlobalOptions } from './types.js';

export async function sync(options: GlobalOptions): Promise<void> {
  log.info('Syncing (push + pull)...\n');

  // Push first
  log.info('--- Push ---');
  await push({ ...options, all: true });

  console.log('');

  // Then pull
  log.info('--- Pull ---');
  await pull(options);

  console.log('');
  log.success('Sync complete');
}
