import react from '@vitejs/plugin-react';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

/**
 * Create aliases for deck.gl v8 and luma.gl v8 packages to avoid conflicts with v9
 */
function createDeckGLv8Aliases() {
  const rootNodeModules = path.resolve(__dirname, '../../node_modules/.pnpm');
  const aliases: any[] = [];

  // List of deck.gl packages to alias
  const deckglPackages = [
    'aggregation-layers',
    'carto',
    'core',
    'extensions',
    'geo-layers',
    'google-maps',
    'json',
    'layers',
    'mapbox',
    'mesh-layers',
    'react',
  ];

  // Create aliases for each deck.gl v8 package
  for (const pkg of deckglPackages) {
    const v8Dirs = fs
      .readdirSync(rootNodeModules)
      .filter((dir) => dir.startsWith(`@deck.gl+${pkg}@8.`));
    if (v8Dirs.length > 0) {
      const pkgPath = path.join(
        rootNodeModules,
        v8Dirs[0],
        'node_modules/@deck.gl',
        pkg,
      );
      aliases.push({
        find: new RegExp(`^@deck\\.gl/${pkg}(\\/.*)?$`),
        replacement: pkgPath + '$1',
      });
    }
  }

  // List of luma.gl packages to alias
  const lumaglPackages = [
    'core',
    'constants',
    'shadertools',
    'experimental',
    'webgl',
    'engine',
    'gltools',
    'gltf',
  ];

  // Create aliases for each luma.gl v8 package
  for (const pkg of lumaglPackages) {
    const v8Dirs = fs
      .readdirSync(rootNodeModules)
      .filter((dir) => dir.startsWith(`@luma.gl+${pkg}@8.`));
    if (v8Dirs.length > 0) {
      const pkgPath = path.join(
        rootNodeModules,
        v8Dirs[0],
        'node_modules/@luma.gl',
        pkg,
      );
      aliases.push({
        find: new RegExp(`^@luma\\.gl/${pkg}(\\/.*)?$`),
        replacement: pkgPath + '$1',
      });
    }
  }

  return aliases;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {find: '@', replacement: path.resolve(__dirname, './src')},
      // Avoid issues with double styled-components
      {
        find: 'styled-components',
        replacement: path.resolve(
          __dirname,
          '../../packages/kepler/node_modules/styled-components',
        ),
      },
      // Force deck.gl v8 and luma.gl v8 for kepler.gl compatibility
      ...createDeckGLv8Aliases(),
    ],
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
