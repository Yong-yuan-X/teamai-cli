import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  readContributeState,
  writeContributeState,
  computeSmartScore,
} from '../contribute-check.js';
import type { ContributeState, DashboardEvent } from '../types.js';

// ─── Test helpers ──────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'teamai-contribute-test-'));
}

function makeEvent(overrides: Partial<DashboardEvent> = {}): DashboardEvent {
  return {
    type: 'tool_use',
    timestamp: new Date().toISOString(),
    sessionId: 'test-session-123',
    tool: 'claude',
    ...overrides,
  };
}

// ─── contributeState read/write (per-session files) ─────────

describe('contributeState', () => {
  let tmpDir: string;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('two sessions read/write without interfering', async () => {
    // Session A writes
    const stateA: ContributeState = {
      toolCount: 50,
      evaluated: false,
      contributed: false,
    };
    await writeContributeState('session-aaa', stateA);

    // Session B writes
    const stateB: ContributeState = {
      toolCount: 10,
      evaluated: false,
      contributed: false,
    };
    await writeContributeState('session-bbb', stateB);

    // Session A reads back its own state, unaffected by B
    const readA = await readContributeState('session-aaa');
    expect(readA.toolCount).toBe(50);

    // Session B reads back its own state, unaffected by A
    const readB = await readContributeState('session-bbb');
    expect(readB.toolCount).toBe(10);
  });

  it('returns defaults when session file does not exist', async () => {
    const state = await readContributeState('nonexistent-session');
    expect(state).toEqual({
      toolCount: 0,
      evaluated: false,
      contributed: false,
    });
  });

  it('returns defaults when session file contains corrupted JSON', async () => {
    const sessionsDir = path.join(tmpDir, '.teamai', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, 'broken-session.json'), '{not valid!!!}', 'utf-8');

    const state = await readContributeState('broken-session');
    expect(state).toEqual({
      toolCount: 0,
      evaluated: false,
      contributed: false,
    });
  });

  it('cleans up session files older than 24 hours on write', async () => {
    const sessionsDir = path.join(tmpDir, '.teamai', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create an old session file with mtime 25 hours ago
    const oldFile = path.join(sessionsDir, 'old-session.json');
    fs.writeFileSync(oldFile, JSON.stringify({ toolCount: 5, evaluated: false, contributed: false }));
    const pastTime = Date.now() - 25 * 60 * 60 * 1000;
    fs.utimesSync(oldFile, new Date(pastTime), new Date(pastTime));

    // Create a recent session file
    const recentFile = path.join(sessionsDir, 'recent-session.json');
    fs.writeFileSync(recentFile, JSON.stringify({ toolCount: 3, evaluated: false, contributed: false }));

    // Writing a new session triggers cleanup
    await writeContributeState('new-session', { toolCount: 1, evaluated: false, contributed: false });

    // Old file should be gone
    expect(fs.existsSync(oldFile)).toBe(false);
    // Recent file should still exist
    expect(fs.existsSync(recentFile)).toBe(true);
    // New file should exist
    expect(fs.existsSync(path.join(sessionsDir, 'new-session.json'))).toBe(true);
  });
});

// ─── computeSmartScore ─────────────────────────────────────

describe('computeSmartScore', () => {
  it('returns 0 for empty events', () => {
    expect(computeSmartScore([])).toBe(0);
  });

  it('scores low for single-tool repetitive session', () => {
    // 20 calls of the same tool — low diversity, below toolCount threshold
    const events = Array.from({ length: 20 }, () =>
      makeEvent({ toolName: 'Bash' }),
    );
    const score = computeSmartScore(events);
    // diversity: 1/20 * 30 = 1.5 → round to 2
    // toolCount < 30: +0
    // No skills, no errors, no duration
    expect(score).toBeLessThan(10);
  });

  it('scores high for diverse session with skills and errors', () => {
    const now = Date.now();
    const events: DashboardEvent[] = [
      // 40 min ago
      makeEvent({ toolName: 'Read', timestamp: new Date(now - 40 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Edit', timestamp: new Date(now - 35 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Bash', timestamp: new Date(now - 30 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Skill', timestamp: new Date(now - 25 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Write', timestamp: new Date(now - 20 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Grep', timestamp: new Date(now - 15 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Agent', timestamp: new Date(now - 10 * 60 * 1000).toISOString() }),
      // Error in prompt
      makeEvent({
        type: 'prompt_submit',
        promptSummary: 'fix the build error',
        timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
      }),
      // Recent
      makeEvent({ toolName: 'Edit', timestamp: new Date(now).toISOString() }),
    ];

    const score = computeSmartScore(events);
    // diversity: high (7 unique / 8 tool_use ≈ 26)
    // hasSkills: +15
    // hasErrors: +15
    // duration > 30 min: +20
    // toolCount = 8 (< 30): +0
    // Total: ~76
    expect(score).toBeGreaterThanOrEqual(35);
  });

  it('gives 15 points for skill usage', () => {
    const base = [
      makeEvent({ toolName: 'Bash' }),
      makeEvent({ toolName: 'Read' }),
    ];
    const withSkill = [
      ...base,
      makeEvent({ toolName: 'Skill' }),
    ];

    const scoreBase = computeSmartScore(base);
    const scoreWithSkill = computeSmartScore(withSkill);
    expect(scoreWithSkill - scoreBase).toBeGreaterThanOrEqual(10); // ~15 but diversity changes too
  });

  it('detects error keywords in prompts', () => {
    const events: DashboardEvent[] = [
      makeEvent({ toolName: 'Bash' }),
      makeEvent({
        type: 'prompt_submit',
        promptSummary: 'there was an error in the build',
      }),
    ];
    const score = computeSmartScore(events);
    // error: +15, some diversity points
    expect(score).toBeGreaterThanOrEqual(15);
  });

  it('gives 20 points for long sessions', () => {
    const now = Date.now();
    const events: DashboardEvent[] = [
      makeEvent({ toolName: 'Bash', timestamp: new Date(now - 60 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Bash', timestamp: new Date(now).toISOString() }),
    ];
    const score = computeSmartScore(events);
    // 1 unique tool / 2 calls → diversity low
    // duration > 30 min → +20
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it('gives toolCount gradient points for 30+ calls', () => {
    // 30 calls → should get 10 points from toolCount
    const events30 = Array.from({ length: 30 }, () =>
      makeEvent({ toolName: 'Bash' }),
    );
    const score30 = computeSmartScore(events30);

    // 80 calls → should get 20 points from toolCount
    const events80 = Array.from({ length: 80 }, () =>
      makeEvent({ toolName: 'Bash' }),
    );
    const score80 = computeSmartScore(events80);

    // 80 calls should score higher than 30 calls due to toolCount gradient
    expect(score80).toBeGreaterThan(score30);
    // 30 calls should get at least 10 toolCount points + some diversity
    expect(score30).toBeGreaterThanOrEqual(10);
  });

  it('typical session (50 calls, 3 tools, 40min) exceeds threshold of 35', () => {
    const now = Date.now();
    // Simulate: 50 calls, 3 unique tools (Bash/Read/Edit), 40 min duration, no Skill/Error
    const events: DashboardEvent[] = [];
    for (let i = 0; i < 50; i++) {
      const tools = ['Bash', 'Read', 'Edit'];
      const minutesAgo = 40 - (i * 40) / 50;
      events.push(
        makeEvent({
          toolName: tools[i % 3],
          timestamp: new Date(now - minutesAgo * 60 * 1000).toISOString(),
        }),
      );
    }

    const score = computeSmartScore(events);
    // toolCount=15 (50 calls) + diversity≈5 (3/20) + duration=20 (40min) = ~40
    expect(score).toBeGreaterThanOrEqual(35);
  });
});
