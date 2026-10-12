import { defineConfig } from 'vitest/config'

// Firestore Security Rules tests (rules/): they need the Firestore emulator, so they run
// through `npm run test:rules` (firebase emulators:exec), never with the app suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules/**/*.test.ts'],
    // Every file shares one emulator database, cleared before each test.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
})
