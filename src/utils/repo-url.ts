/**
 * Re-export from the new provider location.
 * This file exists for backward compatibility — new code should import
 * from '../providers/tgit/repo-url.js' directly.
 */
export { parseTGitRepoInput as parseRepoInput } from '../providers/tgit/repo-url.js';
export type { RepoInfo } from '../providers/types.js';
