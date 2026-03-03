import { log } from './logger.js';

const TGIT_API_BASE = 'https://git.woa.com/api/v3';

export interface TGitUser {
  username: string;
  name: string;
  email: string;
}

function getToken(): string {
  const token = process.env.TGIT_TOKEN;
  if (!token) {
    throw new Error('TGIT_TOKEN environment variable is not set. Get one from https://git.woa.com/profile/personal_access_tokens');
  }
  return token;
}

async function tgitFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  // Use query parameter auth for compatibility with all TGit v3 endpoints
  const separator = path.includes('?') ? '&' : '?';
  const url = `${TGIT_API_BASE}${path}${separator}private_token=${token}`;
  log.debug(`TGit API: ${options?.method ?? 'GET'} ${TGIT_API_BASE}${path}`);
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`TGit API error ${resp.status}: ${body}`);
  }
  return resp;
}

export async function getCurrentUser(): Promise<TGitUser> {
  const resp = await tgitFetch('/user');
  return resp.json() as Promise<TGitUser>;
}

export async function verifyToken(): Promise<TGitUser> {
  try {
    return await getCurrentUser();
  } catch (e) {
    throw new Error(`TGit token verification failed: ${(e as Error).message}`);
  }
}
