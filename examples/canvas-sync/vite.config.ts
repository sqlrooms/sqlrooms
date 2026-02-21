import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), topLevelAwait(), wasm(), tailwindcss()],
  server: {
    port: 4273,
  },
});
