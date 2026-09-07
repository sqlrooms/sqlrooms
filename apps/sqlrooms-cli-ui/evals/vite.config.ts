import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    ssr: path.resolve(directory, '../src/evals/promptfooProvider.ts'),
    outDir: path.resolve(directory, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      external: [/^@duckdb\/node-/],
      output: {
        entryFileNames: 'promptfooProvider.mjs',
      },
    },
  },
  ssr: {
    noExternal: [/^@sqlrooms\//],
  },
});
