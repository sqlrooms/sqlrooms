import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import scaffoldsPlugin from './plugins/scaffolds';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), scaffoldsPlugin(), tailwindcss()],
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
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
