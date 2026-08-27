import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deliberately separate from `vite.config.ts`: that config loads
// `vite-plugin-electron`, which spawns a main-process build on every run. The
// unit suite only covers pure modules, so it needs the path aliases and
// nothing else.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/demo/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
    },
  },
});
