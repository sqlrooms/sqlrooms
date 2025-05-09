import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...Object.fromEntries(
        fs
          .readdirSync(
            path.resolve(__dirname, '../../packages/kepler.gl/src'),
            {
              withFileTypes: true,
            },
          )
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => [
            [`@kepler.gl/${dirent.name}`],
            path.resolve(
              __dirname,
              `../../packages/kepler.gl/src/${dirent.name}/src`,
            ),
          ]),
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
