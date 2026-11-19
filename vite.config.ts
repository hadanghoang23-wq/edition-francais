import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

/**
 * DEV ONLY: serves ../content/packs/*.zip at /dev-packs/ so the app can be tested
 * without picking files. Never part of the production build (apply: 'serve').
 */
function devPacks(): Plugin {
  const dir = path.resolve(__dirname, '../content/packs');
  return {
    name: 'dev-packs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-packs', (req, res) => {
        const name = decodeURIComponent((req.url || '/').slice(1));
        if (!name) {
          const list = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.zip')) : [];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(list));
          return;
        }
        const file = path.join(dir, path.basename(name));
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', 'application/zip');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    devPacks(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Édition — français',
        short_name: 'Édition',
        description: 'Personal French study system built around your own textbook.',
        lang: 'vi',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F1E7',
        theme_color: '#F6F1E7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: { host: true, port: 5173 },
  test: { environment: 'node' },
} as any);
