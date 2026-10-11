import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // gl-bench's browser entry is a global script; Cosmos imports its ESM entry.
    mainFields: ['module', 'browser', 'jsnext:main', 'jsnext'],
  },
});
