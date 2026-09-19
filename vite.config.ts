import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Root by default (custom domain / Cloudflare Pages). For GitHub Pages project URL set VITE_BASE=/MindTouch/.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '點一下',
        short_name: '點一下',
        description: '揀一個你現在的處境，隨機收到一句鼓勵。',
        lang: 'zh-Hant',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#FBF5EE',
        theme_color: '#FBF5EE',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
