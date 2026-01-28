import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: (() => {
      const aliases: any[] = [];

      // Check if we're in the monorepo (pnpm structure exists)
      const monorepoRoot = path.resolve(__dirname, '../..');
      const pnpmModules = path.join(monorepoRoot, 'node_modules/.pnpm');
      const isMonorepo = fs.existsSync(pnpmModules);

      if (isMonorepo) {
        // Force deck.gl v8 and luma.gl v8 for flowmap.gl compatibility
        aliases.push(...createDeckGLv8Aliases(pnpmModules));
      }

      return aliases;
    })(),
  },
});

/**
 * Create aliases for deck.gl v8 and luma.gl v8 packages to avoid conflicts with v9.
 * Only needed in the monorepo where both v8 and v9 exist simultaneously.
 */
function createDeckGLv8Aliases(rootNodeModules: string) {
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
