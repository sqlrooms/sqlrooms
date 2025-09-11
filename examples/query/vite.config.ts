import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
