import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      // Component tests need a DOM environment
      ['src/components/**/*.test.tsx', 'jsdom'],
      ['tests/components/**/*.test.tsx', 'jsdom'],
    ],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/components/**'],
    },
  },
});
