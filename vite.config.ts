import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Swipe',
        short_name: 'Swipe',
        description: 'A card game of nerve & timing',
        theme_color: '#0F1B14',
        background_color: '#0F1B14',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the game needs — it's fully offline after first load
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,m4a}'],
      },
    }),
  ],
  server: { port: 5173, host: true },
});
