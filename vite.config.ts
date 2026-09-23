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
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
