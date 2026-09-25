import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Root by default (custom domain / Cloudflare Pages). For GitHub Pages project URL set VITE_BASE=/MindTouch/.
const base = process.env.VITE_BASE ?? '/';

// The carer app lives at /carer/ with its own manifest and icons. vite-plugin-pwa
// injects the root manifest into every HTML entry, so swap it for that page.
function carerManifest(): Plugin {
  let outDir = 'dist';
  return {
    name: 'carer-manifest',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // vite-plugin-pwa injects its tags after string transforms, so patch the written file.
    writeBundle() {
      const file = resolve(outDir, 'carer/index.html');
      if (!existsSync(file)) return;
      const html = readFileSync(file, 'utf8')
        .replace(/<link rel="manifest"[^>]*>/, `<link rel="manifest" href="${base}carer/manifest.webmanifest">`);
      writeFileSync(file, html);
    },
  };
}

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        carer: resolve(__dirname, 'carer/index.html'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'carer/icon.svg', 'carer/apple-touch-icon.png', 'carer/manifest.webmanifest'],
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
        // Hashed assets are precached; HTML is deliberately NOT, so a visit always fetches
        // the current page from the network and only falls back to a cached copy offline.
        globPatterns: ['**/*.{js,css,svg,png,woff2,webmanifest}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 4,
              fetchOptions: { cache: 'no-cache' },
              expiration: { maxEntries: 8 },
            },
          },
        ],
      },
    }),
    carerManifest(),
  ],
});
