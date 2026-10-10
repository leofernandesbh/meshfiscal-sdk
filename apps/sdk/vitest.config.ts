import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/sdk',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/index.ts'],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
    environment: 'node',
    include: ['test/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
