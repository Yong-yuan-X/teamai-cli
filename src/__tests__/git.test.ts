import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock simple-git before importing
const mockGit = {
  checkoutLocalBranch: vi.fn(),
  add: vi.fn(),
  status: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
  checkout: vi.fn(),
  deleteLocalBranch: vi.fn(),
};

vi.mock('simple-git', () => ({
  default: () => mockGit,
}));

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

import { generateBranchName, pushRepoBranch, pushRepoDirectly } from '../utils/git.js';

describe('generateBranchName', () => {
  it('should produce teamai/push/<username>/<timestamp> format', () => {
    const name = generateBranchName('alice');
    expect(name).toMatch(/^teamai\/push\/alice\/\d{8}-\d{6}$/);
  });

  it('should use the correct current date components', () => {
    const before = new Date();
    const name = generateBranchName('bob');
    const after = new Date();

    // Extract the date part
    const match = name.match(/^teamai\/push\/bob\/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
    expect(match).not.toBeNull();

    const year = parseInt(match![1]);
    const month = parseInt(match![2]);
    const day = parseInt(match![3]);

    expect(year).toBe(before.getFullYear());
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });
});

describe('pushRepoBranch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create branch, commit, push, and return to master when there are changes', async () => {
    mockGit.status.mockResolvedValue({ staged: ['file.txt'] });

    const result = await pushRepoBranch('/repo', 'commit msg', ['file.txt'], 'teamai/push/test/123');

    expect(result).toBe(true);
    expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('teamai/push/test/123');
    expect(mockGit.add).toHaveBeenCalledWith(['file.txt']);
    expect(mockGit.commit).toHaveBeenCalledWith('commit msg');
    expect(mockGit.push).toHaveBeenCalledWith(['-u', 'origin', 'teamai/push/test/123']);
    expect(mockGit.checkout).toHaveBeenCalledWith('master');
  });

  it('should return false and clean up branch when no changes to commit', async () => {
    mockGit.status.mockResolvedValue({ staged: [] });

    const result = await pushRepoBranch('/repo', 'msg', ['file.txt'], 'teamai/push/test/456');

    expect(result).toBe(false);
    expect(mockGit.checkout).toHaveBeenCalledWith('master');
    expect(mockGit.deleteLocalBranch).toHaveBeenCalledWith('teamai/push/test/456', true);
    expect(mockGit.commit).not.toHaveBeenCalled();
    expect(mockGit.push).not.toHaveBeenCalled();
  });
});

describe('pushRepoDirectly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add, commit, and push when there are staged changes', async () => {
    mockGit.status.mockResolvedValue({ staged: ['file.txt'] });

    await pushRepoDirectly('/repo', 'direct commit', ['file.txt']);

    expect(mockGit.add).toHaveBeenCalledWith(['file.txt']);
    expect(mockGit.commit).toHaveBeenCalledWith('direct commit');
    expect(mockGit.push).toHaveBeenCalledWith();
  });

  it('should skip commit and push when nothing is staged', async () => {
    mockGit.status.mockResolvedValue({ staged: [] });

    await pushRepoDirectly('/repo', 'msg', ['file.txt']);

    expect(mockGit.add).toHaveBeenCalledWith(['file.txt']);
    expect(mockGit.commit).not.toHaveBeenCalled();
    expect(mockGit.push).not.toHaveBeenCalled();
  });
});
