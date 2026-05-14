import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';
import {fileURLToPath} from 'node:url';
import scaffoldsPlugin from './plugins/scaffolds';

export default defineConfig({
  plugins: [react(), topLevelAwait(), wasm(), scaffoldsPlugin(), tailwindcss()],
  resolve: {
    alias: {
      'node:zlib': fileURLToPath(
        new URL(
          '../../packages/webcontainer/src/shims/node-zlib.ts',
          import.meta.url,
        ),
      ),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4174,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    proxy: {
      '/api': 'http://localhost:4173',
      '/config.json': 'http://localhost:4173',
    },
  },
  preview: {
    port: 4175,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
});
