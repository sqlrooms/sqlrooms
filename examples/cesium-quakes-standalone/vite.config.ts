import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cesium from 'vite-plugin-cesium';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  optimizeDeps: {
    include: ['cesium'],
  },
});
