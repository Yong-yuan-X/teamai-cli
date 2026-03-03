import YAML from 'yaml';
import path from 'node:path';
import { requireInit } from './config.js';
import { readFileSafe, listFiles } from './utils/fs.js';
import { log } from './utils/logger.js';
import type { GlobalOptions, MemberConfig } from './types.js';

export async function listMembers(options: GlobalOptions): Promise<void> {
  const { localConfig } = await requireInit();
  const membersDir = path.join(localConfig.repo.localPath, 'members');
  const files = await listFiles(membersDir);
  const yamlFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  if (yamlFiles.length === 0) {
    log.info('No team members registered');
    return;
  }

  console.log('');
  console.log(`Team members (${yamlFiles.length}):`);
  console.log('');

  for (const file of yamlFiles) {
    const content = await readFileSafe(path.join(membersDir, file));
    if (!content) continue;
    try {
      const member = YAML.parse(content) as MemberConfig;
      const isSelf = member.username === localConfig.username;
      const marker = isSelf ? ' (you)' : '';
      const display = member.displayName ? ` — ${member.displayName}` : '';
      console.log(`  ${member.username}${display}${marker}`);
      if (options.verbose) {
        console.log(`    registered: ${member.registeredAt}`);
      }
    } catch {
      log.warn(`Invalid member file: ${file}`);
    }
  }
  console.log('');
}
