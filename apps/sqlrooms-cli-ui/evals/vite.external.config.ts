import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
const directory = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  publicDir: false,
  build: {
    ssr: path.resolve(directory, '../src/evals/external/runExternalSuite.ts'),
    outDir: path.resolve(directory, 'external-dist'),
    emptyOutDir: true,
    rollupOptions: {
      external: [/^@duckdb\/node-/, /^@modelcontextprotocol\//],
      output: {entryFileNames: 'runExternalSuite.mjs'},
    },
  },
  ssr: {noExternal: [/^@sqlrooms\//]},
});
