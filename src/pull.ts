import { requireInit, loadState, saveState } from './config.js';
import { pullRepo } from './utils/git.js';
import { log, spinner } from './utils/logger.js';
import { getHandler, RulesHandler } from './resources/index.js';
import type { GlobalOptions, ResourceType } from './types.js';

export async function pull(options: GlobalOptions): Promise<void> {
  const { localConfig, teamConfig } = await requireInit();

  // Step 1: git pull
  const pullSpin = spinner('Pulling team repo...').start();
  try {
    const result = await pullRepo(localConfig.repo.localPath);
    pullSpin.succeed(`Team repo: ${result}`);
  } catch (e) {
    pullSpin.fail(`Pull failed: ${(e as Error).message}`);
    return;
  }

  // Reload team config after pull (might have changed)
  const { teamConfig: freshConfig } = await requireInit();

  // Step 2: Sync each resource type
  const resourceTypes: ResourceType[] = ['skills', 'rules', 'hooks', 'docs', 'instincts'];
  let totalSynced = 0;

  for (const type of resourceTypes) {
    const handler = getHandler(type);

    if (type === 'rules') {
      // Rules use bulk merge into CLAUDE.md
      const rulesHandler = handler as RulesHandler;
      const items = await rulesHandler.scanTeamForPull(freshConfig, localConfig);
      if (items.length > 0) {
        if (options.dryRun) {
          log.info(`[dry-run] Would merge ${items.length} rule(s) into CLAUDE.md`);
        } else {
          await rulesHandler.pullAllRules(freshConfig, localConfig);
          log.success(`Merged ${items.length} rule(s) into CLAUDE.md`);
        }
        totalSynced += items.length;
      }
      continue;
    }

    const items = await handler.scanTeamForPull(freshConfig, localConfig);
    if (items.length === 0) continue;

    if (options.dryRun) {
      log.info(`[dry-run] Would pull ${items.length} ${type}`);
      for (const item of items) {
        log.dim(`  ${item.name}`);
      }
    } else {
      for (const item of items) {
        await handler.pullItem(item, freshConfig, localConfig);
      }
      log.success(`Synced ${items.length} ${type}`);
    }

    totalSynced += items.length;
  }

  if (totalSynced === 0) {
    log.info('No resources to sync');
  } else if (!options.dryRun) {
    // Update state
    const state = await loadState();
    state.lastPull = new Date().toISOString();
    await saveState(state);
  }
}
