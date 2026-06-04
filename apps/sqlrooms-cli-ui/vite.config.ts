import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';
import scaffoldsPlugin from './plugins/scaffolds';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ViteAlias = {find: string | RegExp; replacement: string};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSqlroomsPackageAliases(): ViteAlias[] {
  const packagesDir = path.resolve(__dirname, '../../packages');

  return fs
    .readdirSync(packagesDir, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .flatMap((dirent) => {
      const pkgDir = path.join(packagesDir, dirent.name);
      const packageJsonPath = path.join(pkgDir, 'package.json');
      const sourceIndexPath = path.join(pkgDir, 'src/index.ts');

      if (!fs.existsSync(packageJsonPath) || !fs.existsSync(sourceIndexPath)) {
        return [];
      }

      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        name?: string;
      };

      if (!pkg.name?.startsWith('@sqlrooms/')) return [];

      const escapedName = escapeRegExp(pkg.name);
      const aliases: ViteAlias[] = [
        {
          find: new RegExp(`^${escapedName}$`),
          replacement: sourceIndexPath,
        },
        {
          find: new RegExp(`^${escapedName}/`),
          replacement: `${path.join(pkgDir, 'src')}/`,
        },
      ];

      if (pkg.name === '@sqlrooms/ui') {
        aliases.unshift({
          find: /^@sqlrooms\/ui\/tailwind-preset\.css$/,
          replacement: path.join(pkgDir, 'tailwind-preset.css'),
        });
      }

      return aliases;
    });
}

export default defineConfig({
  plugins: [react(), topLevelAwait(), wasm(), scaffoldsPlugin(), tailwindcss()],
  resolve: {
    alias: [
      ...getSqlroomsPackageAliases(),
      {
        find: 'node:zlib',
        replacement: fileURLToPath(
          new URL(
            '../../packages/webcontainer/src/shims/node-zlib.ts',
            import.meta.url,
          ),
        ),
      },
    ],
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4174,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    proxy: {
      '/api': 'http://localhost:4173',
      '/config.json': 'http://localhost:4173',
    },
  },
  preview: {
    port: 4175,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
});
