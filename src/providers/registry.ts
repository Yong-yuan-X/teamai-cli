import type { GitProvider } from './types.js';
import { TGitProvider } from './tgit/index.js';
import { GitHubProvider } from './github/index.js';

// ─── Provider Detection ──────────────────────────────────
//
//  Input URL / short format        Detected provider
//  ────────────────────────────    ──────────────────
//  https://github.com/o/r         github
//  git@github.com:o/r.git         github
//  https://git.woa.com/o/r        tgit
//  git@git.woa.com:o/r.git        tgit
//  owner/repo (bare)              github (open-source default)
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
 * - Bare `owner/repo`: defaults to 'github' for open-source use cases
 *   (users inside Tencent should use full URLs or configure provider explicitly)
 */
export function detectProvider(input: string): string {
  const trimmed = input.trim();

  // HTTPS URL: extract host
  const httpsMatch = trimmed.match(/^https?:\/\/([^/]+)\//);
  if (httpsMatch) {
    const host = httpsMatch[1].toLowerCase();
    return HOST_MAP[host] ?? 'github';
  }

  // SSH URL: extract host
  const sshMatch = trimmed.match(/^git@([^:]+):/);
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase();
    return HOST_MAP[host] ?? 'github';
  }

  // Bare owner/repo — default to github for open-source use cases
  return 'github';
}

// ─── Provider Factory ────────────────────────────────────

/** Registry of available providers. */
const PROVIDERS: Record<string, () => GitProvider> = {
  tgit: () => new TGitProvider(),
  github: () => new GitHubProvider(),
};

/**
 * Get a provider instance by name.
 * Defaults to 'github' when no name is given (open-source default).
 */
export function getProvider(providerName?: string): GitProvider {
  const name = providerName ?? 'github';
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
  return getProvider(name);
}
