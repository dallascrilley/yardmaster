import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./test/smoke/global-setup.ts'],
    include: ['test/smoke/**/*.test.ts'],
    environment: 'node',
    env: {
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS ?? '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
    },
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    retry: 1,
  },
})
