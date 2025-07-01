import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test configuration for better isolation
    testTimeout: 10000, // 10 seconds per test
    hookTimeout: 10000, // 10 seconds for hooks

    // Environment settings
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', '**/*.d.ts', '**/*.config.*', 'coverage/', 'dist/'],
    },

    // File patterns
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/', 'coverage/'],

    // Sequential execution by default (no parallelism)
    threads: false,
    isolate: false,
  },
});
