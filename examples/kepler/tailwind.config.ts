import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const preset = sqlroomsTailwindPreset({prefix: ''});
const config = {
  ...preset,
  content: [
    'src/**/*.{ts,tsx}',
    // If you make a precise list of packages used, instead of @sqlrooms/*,
    // it would help Vite start faster in dev mode
    '{./,../../}node_modules/@sqlrooms/*/dist/**/*.js',
    '{./,../../}node_modules/.pnpm/node_modules/@sqlrooms/*/dist/**/*.js',
  ],
  theme: {
    ...preset.theme,
    extend: {
      ...preset.theme?.extend,
    },
  },
} satisfies Config;

export default config;
