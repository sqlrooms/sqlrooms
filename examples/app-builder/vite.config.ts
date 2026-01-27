import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import scaffoldsPlugin from './plugins/scaffolds';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), scaffoldsPlugin(), tailwindcss()],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
