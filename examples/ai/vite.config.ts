import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['apache-arrow'],
    alias: {
      'apache-arrow': path.resolve(
        __dirname,
        '../../node_modules/apache-arrow/Arrow.js',
      ),
    },
  },
});
