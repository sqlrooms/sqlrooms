import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
const target = process.env.ROOMIE_API_URL ?? 'http://127.0.0.1:4274';
export default defineConfig({
  base: './',
  plugins: [react(), wasm(), topLevelAwait(), tailwindcss()],
  build: {target: 'esnext'},
  server: {
    host: '127.0.0.1',
    port: 3200,
    strictPort: true,
    proxy: Object.fromEntries(
      ['/api', '/auth.json', '/ws', '/mcp', '/healthz'].map((path) => [
        path,
        {target, ws: true, changeOrigin: false},
      ]),
    ),
  },
});
