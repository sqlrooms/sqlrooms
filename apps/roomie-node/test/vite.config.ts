import {defineConfig, mergeConfig} from 'vite';
import host from '../vite.config.ts';
export default mergeConfig(
  host,
  defineConfig({
    build: {
      ssr: 'test/bridge.ts',
      outDir: 'dist-test',
      rollupOptions: {output: {entryFileNames: 'bridge.mjs'}},
    },
  }),
);
