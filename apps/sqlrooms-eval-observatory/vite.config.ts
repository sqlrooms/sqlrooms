import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {target: 'esnext'},
  resolve: {
    // gl-bench's browser entry is a global script; Cosmos imports its ESM entry.
    mainFields: ['module', 'browser', 'jsnext:main', 'jsnext'],
  },
});
