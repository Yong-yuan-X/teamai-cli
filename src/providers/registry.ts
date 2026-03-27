import type { GitProvider } from './types.js';
import { TGitProvider } from './tgit/index.js';

// ─── Provider Detection ──────────────────────────────────
//
//  Input URL / short format        Detected provider
//  ────────────────────────────    ──────────────────
//  https://github.com/o/r         github
//  git@github.com:o/r.git         github
//  https://git.woa.com/o/r        tgit
//  git@git.woa.com:o/r.git        tgit
//  owner/repo (bare)              tgit (default, until github provider is available)
//

/** Known host → provider name mapping. */
const HOST_MAP: Record<string, string> = {
  'github.com': 'github',
  'git.woa.com': 'tgit',
};

/**
 * Detect which git provider to use based on a repo URL or short format.
 * Returns provider name string ('github' | 'tgit').
 *
 * - Full URL (HTTPS or SSH): matched by host
 * - Bare `owner/repo`: defaults to 'tgit' until GitHub provider is available (PR2)
 */
export function detectProvider(input: string): string {
  const trimmed = input.trim();

  // HTTPS URL: extract host
  const httpsMatch = trimmed.match(/^https?:\/\/([^/]+)\//);
  if (httpsMatch) {
    const host = httpsMatch[1].toLowerCase();
    return HOST_MAP[host] ?? 'tgit';
  }

  // SSH URL: extract host
  const sshMatch = trimmed.match(/^git@([^:]+):/);
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase();
    return HOST_MAP[host] ?? 'tgit';
  }

  // Bare owner/repo — default to tgit for backward compatibility
  // Will change to 'github' in PR2 when GitHubProvider is implemented
  return 'tgit';
}

// ─── Provider Factory ────────────────────────────────────

/** Registry of available providers. */
const PROVIDERS: Record<string, () => GitProvider> = {
  tgit: () => new TGitProvider(),
  // github: () => new GitHubProvider(),  // PR2
};

/**
 * Get a provider instance by name.
 * Defaults to 'tgit' for backward compatibility with existing installs.
 */
export function getProvider(providerName?: string): GitProvider {
  const name = providerName ?? 'tgit';
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `Unknown git provider: "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}`,
    );
  }
  return factory();
}

/**
 * Get a provider instance by detecting the platform from a repo URL.
 */
export function getProviderFromUrl(repoUrl: string): GitProvider {
  const name = detectProvider(repoUrl);
  // If detected as github but provider not yet available, fall back to tgit
  if (name === 'github' && !PROVIDERS[name]) {
    throw new Error(
      'GitHub provider is not yet available. It will be added in a future release.\n' +
      'For now, please use a TGit (git.woa.com) repository.',
    );
  }
  return getProvider(name);
}
