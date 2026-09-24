import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tests are self-contained: they never need a .env file or a CI secret.
// Pinned to a zone other than the app's (Europe/Paris) so tests prove that what the
// app shows does not depend on the device's time zone. Set before workers start.
process.env.TZ = 'America/New_York'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Dummy Firebase config: tests mock Firestore / Auth and never reach a real project.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-baby-tracker.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-baby-tracker',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-baby-tracker.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FCM_VAPID_KEY: 'test-vapid-key',
    },
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/sw.ts', 'src/test/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
