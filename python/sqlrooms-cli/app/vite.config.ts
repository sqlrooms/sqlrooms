import {defineConfig} from 'vite';
import {resolve} from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../sqlrooms_cli/static'),
    emptyOutDir: true,
  },
  server: {
    port: 4174,
    proxy: {
      '/api': 'http://localhost:4173',
      '/config.json': 'http://localhost:4173',
    },
  },
  preview: {
    port: 4175,
  },
});
