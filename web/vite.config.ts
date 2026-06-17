import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.API_TARGET || 'http://localhost:23103';

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: { enabled: false },
      manifest: {
        name: 'Laundry Recipe',
        short_name: 'Laundry',
        description: 'Step-by-step guide to the family laundry process',
        theme_color: '#0ea5e9',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 32035,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});
