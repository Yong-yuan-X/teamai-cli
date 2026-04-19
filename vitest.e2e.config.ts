import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/__tests__/e2e/**/*.test.ts',
      'src/__tests__/*-e2e.test.ts',
    ],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // E2E tests spawn child processes and touch the real filesystem; a few
    // (notably auto-recall-e2e) are inherently slightly flaky on CI runners
    // due to timing/state. Retry once: flaky tests recover, real bugs stay
    // failed (since they'll fail both runs).
    retry: 1,
  },
});
