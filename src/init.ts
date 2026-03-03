import YAML from 'yaml';
import path from 'node:path';
import readline from 'node:readline';
import { saveLocalConfig, loadTeamConfig } from './config.js';
import { injectHooksToAllTools } from './hooks.js';
import { cloneRepo } from './utils/git.js';
import { pushRepo } from './utils/git.js';
import { verifyToken, getCurrentUser } from './utils/tgit-api.js';
import { ensureDir, writeFile, pathExists, expandHome } from './utils/fs.js';
import { log, spinner } from './utils/logger.js';
import { TAD_HOME, type GlobalOptions, type LocalConfig } from './types.js';

function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function init(options: GlobalOptions & { repo?: string }): Promise<void> {
  log.info('Initializing tad...');

  // Step 1: Verify TGit token
  const spin = spinner('Verifying TGit token...').start();
  let user;
  try {
    user = await verifyToken();
    spin.succeed(`Authenticated as ${user.username} (${user.name})`);
  } catch (e) {
    spin.fail((e as Error).message);
    log.info('Set TGIT_TOKEN environment variable with a personal access token from:');
    log.info('https://git.woa.com/profile/personal_access_tokens');
    process.exit(1);
  }

  // Step 2: Get repo URL
  let repoUrl = options.repo ?? '';
  if (!repoUrl) {
    repoUrl = await askQuestion('Team repo URL (e.g. git@git.woa.com:team/tad-team.git): ');
  }
  if (!repoUrl) {
    log.error('Repo URL is required');
    process.exit(1);
  }

  // Step 3: Clone or link repo
  const defaultLocalPath = path.join(process.env.HOME ?? '', '.tad', 'team-repo');
  let localPath = await askQuestion(`Local clone path [${defaultLocalPath}]: `);
  if (!localPath) localPath = defaultLocalPath;
  localPath = expandHome(localPath);

  if (await pathExists(localPath)) {
    log.info(`Repo already exists at ${localPath}, using existing clone`);
  } else {
    const cloneSpin = spinner('Cloning team repo...').start();
    try {
      await cloneRepo(repoUrl, localPath);
      cloneSpin.succeed('Team repo cloned');
    } catch (e) {
      cloneSpin.fail(`Clone failed: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // Step 4: Load team config
  const teamConfig = await loadTeamConfig(localPath);
  if (!teamConfig) {
    log.warn('tad.yaml not found in repo. Creating default config...');
    const defaultConfig = YAML.stringify({
      team: 'my-team',
      description: 'Team AI DevKit shared resources',
      repo: repoUrl,
      sharing: {
        skills: { syncTargets: ['claude', 'codex', 'claude-internal', 'cursor'] },
        rules: { enforced: [] },
        docs: { localDir: '~/.tad/docs' },
      },
    });
    await writeFile(path.join(localPath, 'tad.yaml'), defaultConfig);

    // Create standard directories
    for (const dir of ['members', 'skills', 'rules', 'docs', 'hooks', 'hooks/scripts', 'instincts']) {
      await ensureDir(path.join(localPath, dir));
      // create .gitkeep in empty dirs
      const gitkeep = path.join(localPath, dir, '.gitkeep');
      if (!await pathExists(gitkeep)) {
        await writeFile(gitkeep, '');
      }
    }
  }

  // Step 5: Create member file
  const memberPath = path.join(localPath, 'members', `${user.username}.yaml`);
  if (!await pathExists(memberPath)) {
    const memberYaml = YAML.stringify({
      username: user.username,
      displayName: user.name || user.username,
      registeredAt: new Date().toISOString(),
    });
    await writeFile(memberPath, memberYaml);
    log.success(`Registered as team member: ${user.username}`);

    if (!options.dryRun) {
      try {
        await pushRepo(localPath, `[tad] Register member: ${user.username}`, [
          'members/',
          'tad.yaml',
          'skills/.gitkeep',
          'rules/.gitkeep',
          'docs/.gitkeep',
          'hooks/.gitkeep',
          'hooks/scripts/.gitkeep',
          'instincts/.gitkeep',
        ]);
        log.success('Member registration pushed to team repo');
      } catch (e) {
        log.warn(`Push failed (you can push manually later): ${(e as Error).message}`);
      }
    }
  } else {
    log.info(`Member ${user.username} already registered`);
  }

  // Step 6: Save local config
  const localConfig: LocalConfig = {
    repo: { localPath, remote: repoUrl },
    username: user.username,
  };
  await ensureDir(TAD_HOME);
  await saveLocalConfig(localConfig);
  log.success(`Local config saved to ${TAD_HOME}/config.yaml`);

  // Step 7: Inject hooks into AI tools
  const reloadedTeamConfig = await loadTeamConfig(localPath);
  if (reloadedTeamConfig) {
    await injectHooksToAllTools(reloadedTeamConfig.toolPaths);
  }

  log.success('tad initialized successfully!');
  log.info('Run `tad pull` to sync team resources, or `tad status` to check.');
}
