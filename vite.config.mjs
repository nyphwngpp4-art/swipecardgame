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
        description: 'Your favourite seat at the card table. Relaxed games, daily deals, and a helping hand.',
        theme_color: '#244b3c',
        background_color: '#f7f5ed',
        display: 'standalone',
        orientation: 'any',
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
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', '@capacitor/core', '@capacitor/haptics', '@capacitor/status-bar'],
  },
  server: { port: 5173, host: true, watch: { usePolling: true, interval: 500 } },
});
