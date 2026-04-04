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
    const stateA: ContributeState = { contributed: false };
    await writeContributeState('session-aaa', stateA);

    const stateB: ContributeState = { contributed: true };
    await writeContributeState('session-bbb', stateB);

    const readA = await readContributeState('session-aaa');
    expect(readA.contributed).toBe(false);

    const readB = await readContributeState('session-bbb');
    expect(readB.contributed).toBe(true);
  });

  it('returns defaults when session file does not exist', async () => {
    const state = await readContributeState('nonexistent-session');
    expect(state).toEqual({ contributed: false });
  });

  it('returns defaults when session file contains corrupted JSON', async () => {
    const sessionsDir = path.join(tmpDir, '.teamai', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, 'broken-session.json'), '{not valid!!!}', 'utf-8');

    const state = await readContributeState('broken-session');
    expect(state).toEqual({ contributed: false });
  });

  it('backward compat: reads legacy state with toolCount/evaluated fields', async () => {
    const sessionsDir = path.join(tmpDir, '.teamai', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    // Legacy format had toolCount and evaluated fields
    fs.writeFileSync(
      path.join(sessionsDir, 'legacy-session.json'),
      JSON.stringify({ toolCount: 50, evaluated: true, contributed: true, smartScore: 42 }),
      'utf-8',
    );

    const state = await readContributeState('legacy-session');
    // Should read contributed and smartScore, ignore toolCount/evaluated
    expect(state.contributed).toBe(true);
    expect(state.smartScore).toBe(42);
  });

  it('cleans up session files older than 24 hours on write', async () => {
    const sessionsDir = path.join(tmpDir, '.teamai', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });

    const oldFile = path.join(sessionsDir, 'old-session.json');
    fs.writeFileSync(oldFile, JSON.stringify({ contributed: false }));
    const pastTime = Date.now() - 25 * 60 * 60 * 1000;
    fs.utimesSync(oldFile, new Date(pastTime), new Date(pastTime));

    const recentFile = path.join(sessionsDir, 'recent-session.json');
    fs.writeFileSync(recentFile, JSON.stringify({ contributed: false }));

    await writeContributeState('new-session', { contributed: false });

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(recentFile)).toBe(true);
    expect(fs.existsSync(path.join(sessionsDir, 'new-session.json'))).toBe(true);
  });
});

// ─── computeSmartScore ─────────────────────────────────────

describe('computeSmartScore', () => {
  it('returns 0 for empty events', () => {
    expect(computeSmartScore([])).toBe(0);
  });

  it('scores low for single-tool repetitive session', () => {
    const events = Array.from({ length: 20 }, () =>
      makeEvent({ toolName: 'Bash' }),
    );
    const score = computeSmartScore(events);
    expect(score).toBeLessThan(10);
  });

  it('scores high for diverse session with skills and errors', () => {
    const now = Date.now();
    const events: DashboardEvent[] = [
      makeEvent({ toolName: 'Read', timestamp: new Date(now - 40 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Edit', timestamp: new Date(now - 35 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Bash', timestamp: new Date(now - 30 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Skill', timestamp: new Date(now - 25 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Write', timestamp: new Date(now - 20 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Grep', timestamp: new Date(now - 15 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Agent', timestamp: new Date(now - 10 * 60 * 1000).toISOString() }),
      makeEvent({
        type: 'prompt_submit',
        promptSummary: 'fix the build error',
        timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
      }),
      makeEvent({ toolName: 'Edit', timestamp: new Date(now).toISOString() }),
    ];

    const score = computeSmartScore(events);
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
    expect(scoreWithSkill - scoreBase).toBeGreaterThanOrEqual(10);
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
    expect(score).toBeGreaterThanOrEqual(15);
  });

  it('gives 20 points for long sessions', () => {
    const now = Date.now();
    const events: DashboardEvent[] = [
      makeEvent({ toolName: 'Bash', timestamp: new Date(now - 60 * 60 * 1000).toISOString() }),
      makeEvent({ toolName: 'Bash', timestamp: new Date(now).toISOString() }),
    ];
    const score = computeSmartScore(events);
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it('gives toolCount gradient points for 30+ calls', () => {
    const events30 = Array.from({ length: 30 }, () =>
      makeEvent({ toolName: 'Bash' }),
    );
    const score30 = computeSmartScore(events30);

    const events80 = Array.from({ length: 80 }, () =>
      makeEvent({ toolName: 'Bash' }),
    );
    const score80 = computeSmartScore(events80);

    expect(score80).toBeGreaterThan(score30);
    expect(score30).toBeGreaterThanOrEqual(10);
  });

  it('typical session (50 calls, 3 tools, 40min) exceeds threshold of 35', () => {
    const now = Date.now();
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
    expect(score).toBeGreaterThanOrEqual(35);
  });
});
