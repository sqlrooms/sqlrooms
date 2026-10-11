import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  build: {target: 'esnext'},
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth.json': {target: 'http://127.0.0.1:4000', changeOrigin: true},
      '/api': {target: 'http://127.0.0.1:4000', changeOrigin: true},
      '/ws/duckdb': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
        changeOrigin: true,
      },
      '/ws/mcp-bridge': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   manifest: {
    //     name: 'SQLRooms Query Workbench',
    //     short_name: 'SQLRooms',
    //     start_url: '.',
    //     display: 'standalone',
    //     background_color: '#ffffff',
    //     description: 'Query Workbench example for SQLRooms',
    //     icons: [
    //       {
    //         src: 'icon.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //       },
    //       {
    //         src: 'icon.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //       },
    //     ],
    //   },
    // }),
  ],
});
