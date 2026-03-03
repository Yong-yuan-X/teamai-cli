import YAML from 'yaml';
import path from 'node:path';
import {
  TadConfigSchema,
  LocalConfigSchema,
  StateSchema,
  TAD_CONFIG_PATH,
  TAD_STATE_PATH,
  type TadConfig,
  type LocalConfig,
  type State,
} from './types.js';
import { readFileSafe, readJson, writeFile, writeJson, expandHome } from './utils/fs.js';
import { log } from './utils/logger.js';

/**
 * Load the team config (tad.yaml) from the team repo
 */
export async function loadTeamConfig(repoPath: string): Promise<TadConfig | null> {
  const content = await readFileSafe(path.join(repoPath, 'tad.yaml'));
  if (!content) {
    log.debug('tad.yaml not found in repo');
    return null;
  }
  try {
    const raw = YAML.parse(content);
    return TadConfigSchema.parse(raw);
  } catch (e) {
    log.error(`Invalid tad.yaml: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Load the local config (~/.tad/config.yaml)
 */
export async function loadLocalConfig(): Promise<LocalConfig | null> {
  const content = await readFileSafe(expandHome(TAD_CONFIG_PATH));
  if (!content) return null;
  try {
    const raw = YAML.parse(content);
    return LocalConfigSchema.parse(raw);
  } catch (e) {
    log.debug(`Invalid local config: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Save the local config
 */
export async function saveLocalConfig(config: LocalConfig): Promise<void> {
  await writeFile(expandHome(TAD_CONFIG_PATH), YAML.stringify(config));
}

/**
 * Load the local state (~/.tad/state.json)
 */
export async function loadState(): Promise<State> {
  const raw = await readJson<Record<string, unknown>>(expandHome(TAD_STATE_PATH));
  if (!raw) return StateSchema.parse({});
  return StateSchema.parse(raw);
}

/**
 * Save the local state
 */
export async function saveState(state: State): Promise<void> {
  await writeJson(expandHome(TAD_STATE_PATH), state);
}

/**
 * Require that tad is initialized (local config exists)
 */
export async function requireInit(): Promise<{ localConfig: LocalConfig; teamConfig: TadConfig }> {
  const localConfig = await loadLocalConfig();
  if (!localConfig) {
    throw new Error('tad is not initialized. Run `tad init` first.');
  }
  const teamConfig = await loadTeamConfig(localConfig.repo.localPath);
  if (!teamConfig) {
    throw new Error('Team config (tad.yaml) not found. Check your repo path.');
  }
  return { localConfig, teamConfig };
}
