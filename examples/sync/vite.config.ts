import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), topLevelAwait(), wasm()],
  build: {
    target: 'esnext',
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth.json': {target: 'http://127.0.0.1:4000', changeOrigin: true},
      '/api': {target: 'http://127.0.0.1:4000', changeOrigin: true},
      '/ws/duckdb': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
        changeOrigin: true,
      },
      '/ws/mcp-bridge': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
