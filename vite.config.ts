import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: {
        name: 'Baby Tracker',
        short_name: 'Baby Tracker',
        description: 'Shared baby tracking for parents',
        lang: 'en',
        start_url: '/',
        display: 'standalone',
        background_color: '#F7F1E4',
        theme_color: '#1F3A5C',
        // PNG sizes let Chrome on Android install the app as a real app (WebAPK):
        // notifications then come from "Baby Tracker", not from Chrome.
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
