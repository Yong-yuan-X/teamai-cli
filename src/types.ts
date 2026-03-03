import { z } from 'zod';

// ─── Tool path config ───────────────────────────────────

export const ToolPathsSchema = z.object({
  skills: z.string(),
  settings: z.string().optional(),
  claudemd: z.string().optional(),
});

// ─── Team config (tad.yaml) ─────────────────────────────

export const SharingConfigSchema = z.object({
  skills: z.object({
    syncTargets: z.array(z.string()).default(['claude', 'codex', 'claude-internal', 'cursor']),
  }).default({}),
  rules: z.object({
    enforced: z.array(z.string()).default([]),
  }).default({}),
  docs: z.object({
    localDir: z.string().default('~/.tad/docs'),
  }).default({}),
});

export const TadConfigSchema = z.object({
  team: z.string(),
  description: z.string().default(''),
  repo: z.string(),
  sharing: SharingConfigSchema.default({}),
  toolPaths: z.record(z.string(), ToolPathsSchema).default({
    claude: { skills: '.claude/skills', settings: '.claude/settings.json', claudemd: '.claude/CLAUDE.md' },
    codex: { skills: '.codex/skills' },
    'claude-internal': { skills: '.claude-internal/skills', settings: '.claude-internal/settings.json' },
    cursor: { skills: '.cursor/skills-cursor' },
  }),
});

export type TadConfig = z.infer<typeof TadConfigSchema>;

// ─── Member config (members/<user>.yaml) ────────────────

export const MemberConfigSchema = z.object({
  username: z.string(),
  displayName: z.string().default(''),
  registeredAt: z.string(),
});

export type MemberConfig = z.infer<typeof MemberConfigSchema>;

// ─── Local config (~/.tad/config.yaml) ──────────────────

export const LocalConfigSchema = z.object({
  repo: z.object({
    localPath: z.string(),
    remote: z.string(),
  }),
  username: z.string(),
});

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

// ─── Local state (~/.tad/state.json) ────────────────────

export const StateSchema = z.object({
  lastPush: z.string().nullable().default(null),
  lastPull: z.string().nullable().default(null),
  pushedInstincts: z.array(z.string()).default([]),
  pushedSkills: z.array(z.string()).default([]),
});

export type State = z.infer<typeof StateSchema>;

// ─── Resource types ─────────────────────────────────────

export type ResourceType = 'skills' | 'rules' | 'hooks' | 'docs' | 'instincts';

export interface ResourceItem {
  name: string;
  type: ResourceType;
  sourcePath: string;
  relativePath: string;
}

export interface ResourceDiff {
  added: ResourceItem[];
  modified: ResourceItem[];
  removed: ResourceItem[];
}

// ─── Global options ─────────────────────────────────────

export interface GlobalOptions {
  dryRun?: boolean;
  verbose?: boolean;
  silent?: boolean;
}

// ─── Constants ──────────────────────────────────────────

export const TAD_HOME = `${process.env.HOME}/.tad`;
export const TAD_CONFIG_PATH = `${TAD_HOME}/config.yaml`;
export const TAD_STATE_PATH = `${TAD_HOME}/state.json`;
export const TAD_TOKEN_PATH = `${TAD_HOME}/token`;

export const RESOURCE_TYPES: ResourceType[] = ['skills', 'rules', 'hooks', 'docs', 'instincts'];

export const TAD_RULES_START = '<!-- [tad:rules:start] -->';
export const TAD_RULES_END = '<!-- [tad:rules:end] -->';

export const TAD_HOOK_DESCRIPTION_PREFIX = '[tad]';
