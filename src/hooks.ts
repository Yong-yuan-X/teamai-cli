import path from 'node:path';
import { readJson, writeJson, readFileSafe, expandHome } from './utils/fs.js';
import { log } from './utils/logger.js';
import { TEAMAI_HOOK_DESCRIPTION_PREFIX } from './types.js';

interface HookEntry {
  type: string;
  command: string;
}

interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
  description?: string;
}

interface SettingsJson {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

const TEAMAI_SESSION_START_HOOK: HookMatcher = {
  matcher: '*',
  hooks: [{ type: 'command', command: 'bash -lc "teamai pull --silent" 2>/dev/null || true' }],
  description: `${TEAMAI_HOOK_DESCRIPTION_PREFIX} Auto-pull team resources on session start`,
};

/**
 * Inject teamai hooks into a settings.json file
 */
export async function injectHooks(settingsPath: string): Promise<void> {
  const expanded = expandHome(settingsPath);
  const settings: SettingsJson = (await readJson<SettingsJson>(expanded)) ?? {};

  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }

  // Check if teamai hook already exists
  const existing = settings.hooks.SessionStart.find(
    (h) => h.description?.startsWith(TEAMAI_HOOK_DESCRIPTION_PREFIX)
  );
  if (existing) {
    log.debug(`teamai hook already exists in ${settingsPath}`);
    return;
  }

  settings.hooks.SessionStart.push(TEAMAI_SESSION_START_HOOK);
  await writeJson(expanded, settings);
  log.success(`Injected teamai hook into ${settingsPath}`);
}

/**
 * Remove teamai hooks from a settings.json file
 */
export async function removeHooks(settingsPath: string): Promise<void> {
  const expanded = expandHome(settingsPath);
  const settings = await readJson<SettingsJson>(expanded);
  if (!settings?.hooks) return;

  let changed = false;
  for (const [event, matchers] of Object.entries(settings.hooks)) {
    const filtered = matchers.filter(
      (h) => !h.description?.startsWith(TEAMAI_HOOK_DESCRIPTION_PREFIX)
    );
    if (filtered.length !== matchers.length) {
      settings.hooks[event] = filtered;
      changed = true;
    }
  }

  if (changed) {
    await writeJson(expanded, settings);
    log.success(`Removed teamai hooks from ${settingsPath}`);
  }
}

/**
 * Inject teamai hooks into all AI tool settings
 */
export async function injectHooksToAllTools(toolPaths: Record<string, { settings?: string }>): Promise<void> {
  for (const [tool, paths] of Object.entries(toolPaths)) {
    if (paths.settings) {
      const settingsPath = path.join(process.env.HOME ?? '', paths.settings);
      try {
        await injectHooks(settingsPath);
      } catch (e) {
        log.warn(`Failed to inject hook into ${tool}: ${(e as Error).message}`);
      }
    }
  }
}
