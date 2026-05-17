import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/lib/**/*.test.ts', '__tests__/api/**/*.test.ts'],
    exclude: ['__tests__/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/db.ts', 'lib/prompts/**'],
      thresholds: { lines: 80, functions: 80, branches: 80 },
    },
  },
})
