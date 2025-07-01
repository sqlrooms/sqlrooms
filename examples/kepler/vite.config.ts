import react from '@vitejs/plugin-react';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized';
import path from 'path';
import {defineConfig} from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Avoid issues with double styled-components
      'styled-components': path.resolve(
        __dirname,
        '../../packages/kepler/node_modules/styled-components',
      ),
    },
  },
  build: {
    minify: false,
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        // See https://github.com/bvaughn/react-virtualized/issues/1722#issuecomment-1911672178
        fixReactVirtualized as any,
      ],
    },
  },
});
