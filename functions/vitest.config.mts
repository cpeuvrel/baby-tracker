import { defineConfig } from 'vitest/config'

// Pinned to a zone that is neither UTC (Cloud Functions) nor Europe/Paris (the
// app's), like the web app's tests: what the functions compute must not depend on it.
// Set before workers start.
process.env.TZ = 'America/New_York'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
