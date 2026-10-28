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
        // Avoid issues with double styled-components: use the copy that
        // @kepler.gl/sqlrooms resolves (a sibling in the pnpm store).
        const keplerSqlrooms = fs.realpathSync(
          path.join(__dirname, 'node_modules/@kepler.gl/sqlrooms'),
        );
        aliases.push({
          find: 'styled-components',
          replacement: path.join(keplerSqlrooms, '../../styled-components'),
        });
      }

      return aliases;
    })(),
  },
  build: {
    minify: false,
  },
  optimizeDeps: {
    // @kepler.gl/sqlrooms is pre-bundled from node_modules. In the monorepo the
    // @sqlrooms/* packages are workspace links, which Vite would otherwise inline
    // into that bundle, creating a second room store. Pre-bundling them too
    // makes the app and Kepler share one copy of each.
    include: [
      '@sqlrooms/ai-config',
      '@sqlrooms/artifacts',
      '@sqlrooms/blocks',
      '@sqlrooms/codemirror',
      '@sqlrooms/data-table',
      '@sqlrooms/db',
      '@sqlrooms/dropzone',
      '@sqlrooms/duckdb',
      '@sqlrooms/duckdb-core',
      '@sqlrooms/layout',
      '@sqlrooms/layout-config',
      '@sqlrooms/monaco-editor',
      '@sqlrooms/room-config',
      '@sqlrooms/room-shell',
      '@sqlrooms/room-store',
      '@sqlrooms/s3-browser',
      '@sqlrooms/schema-tree',
      '@sqlrooms/sql-editor',
      '@sqlrooms/sql-editor-config',
      '@sqlrooms/ui',
      '@sqlrooms/utils',
    ],
    esbuildOptions: {
      plugins: [
        // See https://github.com/bvaughn/react-virtualized/issues/1722#issuecomment-1911672178
        fixReactVirtualized as any,
      ],
    },
  },
});
