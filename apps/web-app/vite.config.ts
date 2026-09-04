import {cloudflare} from '@cloudflare/vite-plugin';
import {devtools} from '@tanstack/devtools-vite';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  resolve: {tsconfigPaths: true},
  plugins: [
    devtools(),
    cloudflare({viteEnvironment: {name: 'ssr'}}),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
