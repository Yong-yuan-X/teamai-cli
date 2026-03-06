import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger to avoid side effects
vi.mock('../utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    dim: vi.fn(),
  },
}));

// We need to mock `fetch` at the global level and set TGIT_TOKEN
const mockFetch = vi.fn();

describe('TGit API', () => {
  const originalEnv = process.env.TGIT_TOKEN;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.TGIT_TOKEN = 'test-token-123';
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TGIT_TOKEN = originalEnv;
    } else {
      delete process.env.TGIT_TOKEN;
    }
    globalThis.fetch = originalFetch;
  });

  describe('searchUsers', () => {
    it('should call GET /users?search= with encoded query', async () => {
      const mockUsers = [
        { id: 1, username: 'alice', name: 'Alice Chen' },
        { id: 2, username: 'alice2', name: 'Alice Wang' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      });

      const { searchUsers } = await import('../utils/tgit-api.js');
      const result = await searchUsers('alice');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/users?search=alice');
      expect(calledUrl).toContain('private_token=test-token-123');
      expect(result).toEqual(mockUsers);
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const { searchUsers } = await import('../utils/tgit-api.js');
      await expect(searchUsers('fail')).rejects.toThrow('TGit API error 500');
    });
  });

  describe('createMergeRequest', () => {
    it('should POST to /projects/:id/merge_requests with required fields', async () => {
      const mockMR = {
        id: 1,
        iid: 10,
        title: 'test MR',
        state: 'opened',
        web_url: 'https://git.woa.com/team/repo/merge_requests/10',
        source_branch: 'feature',
        target_branch: 'master',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMR),
      });

      const { createMergeRequest } = await import('../utils/tgit-api.js');
      const result = await createMergeRequest(
        'team%2Frepo',
        'feature',
        'master',
        'test MR',
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/projects/team%2Frepo/merge_requests');
      const calledOpts = mockFetch.mock.calls[0][1] as RequestInit;
      expect(calledOpts.method).toBe('POST');
      const body = JSON.parse(calledOpts.body as string);
      expect(body.source_branch).toBe('feature');
      expect(body.target_branch).toBe('master');
      expect(body.title).toBe('test MR');
      expect(body.reviewer_ids).toBeUndefined();
      expect(result).toEqual(mockMR);
    });

    it('should include reviewer_ids when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, iid: 10, title: 'MR', state: 'opened', web_url: '', source_branch: 'b', target_branch: 'master' }),
      });

      const { createMergeRequest } = await import('../utils/tgit-api.js');
      await createMergeRequest(
        'team%2Frepo',
        'branch',
        'master',
        'MR with reviewers',
        'desc',
        [100, 200],
      );

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.reviewers).toBe('100,200');
      expect(body.description).toBe('desc');
    });
  });

  describe('getUserByUsername', () => {
    it('should return the user matching exact username', async () => {
      const mockUsers = [
        { id: 1, username: 'alice', name: 'Alice Chen' },
        { id: 2, username: 'alice2', name: 'Alice Wang' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUsers),
      });

      const { getUserByUsername } = await import('../utils/tgit-api.js');
      const result = await getUserByUsername('alice');

      expect(result).toEqual({ id: 1, username: 'alice', name: 'Alice Chen' });
    });

    it('should return null when no exact match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 2, username: 'alice2', name: 'Alice Wang' }]),
      });

      const { getUserByUsername } = await import('../utils/tgit-api.js');
      const result = await getUserByUsername('alice');

      expect(result).toBeNull();
    });
  });
});
