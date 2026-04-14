import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: (() => {
      const aliases: any[] = [];

      // Check if we're in the monorepo (pnpm structure exists)
      const monorepoRoot = path.resolve(__dirname, '../..');
      const pnpmModules = path.join(monorepoRoot, 'node_modules/.pnpm');
      const isMonorepo = fs.existsSync(pnpmModules);

      if (isMonorepo) {
        // Avoid issues with double styled-components
        aliases.push({
          find: 'styled-components',
          replacement: path.join(
            monorepoRoot,
            'packages/kepler/node_modules/styled-components',
          ),
        });
      }

      return aliases;
    })(),
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
