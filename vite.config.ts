import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: '胖齊肥柔去走走',
        short_name: '胖齊肥柔去走走',
        description: '個人國內外旅行行程規劃',
        theme_color: '#2C4A3D',
        background_color: '#FAF7F0',
        display: 'standalone',
        lang: 'zh-Hant-TW',
        icons: [
          // 一張 logo.png 涵蓋所有尺寸需求（瀏覽器會自動縮放）。
          // 想最佳化的話，未來再另外做 192/512 兩個版本。
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // 新 SW 立刻接管，不卡在舊 worker 的快取上
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          // ⚠️ 不要快取 maps.googleapis.com。
          // 原因：Workbox 的 SW 攔截後會自己發 fetch()，這個 fetch 從 SW context 送出
          // 去的 Referer header 跟原本 <img>/script 標籤送的不一樣（通常會變空字串或
          // sw.js 的 URL），對不上 Google API Key 的 HTTP referrer 白名單 → 整批 403。
          // Static Maps、Maps JS、Directions、Places 全部都會掛。
          // Google 自己的 CDN + 瀏覽器 HTTP cache 已經夠用，SW 介入沒好處。
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
