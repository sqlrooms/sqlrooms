import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/index.ts',
    outDir: 'dist',
    rollupOptions: {
      // All bundled connector code resolves the host's explicitly pinned engine.
      external: [/^@duckdb\/node-/, 'loro-crdt', 'loro-mirror', 'react'],
      output: {entryFileNames: 'index.mjs'},
    },
  },
  ssr: {noExternal: [/^@sqlrooms\//]},
});
