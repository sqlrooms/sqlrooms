import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// See https://loro.dev/docs/tutorial/get_started#install
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
});
