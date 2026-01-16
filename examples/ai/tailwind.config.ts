import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const config = {
  presets: [sqlroomsTailwindPreset()],
  content: [
    'src/**/*.{ts,tsx}',
    '../packages/*/src/**/*.{ts,tsx}',
    // If you make a precise list of packages used, instead of @sqlrooms/*,
    // it would help Vite start faster in dev mode
    '{./,../../}node_modules/@sqlrooms/*/dist/**/*.js',
    '{./,../../}node_modules/.pnpm/node_modules/@sqlrooms/*/dist/**/*.js',
  ],
} satisfies Config;

export default config;
