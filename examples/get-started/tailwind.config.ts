import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const config = {
  presets: [sqlroomsTailwindPreset()],
  content: [
    'src/**/*.{ts,tsx}',
    './node_modules/@sqlrooms/*/dist/**/*.js',
    '../../node_modules/@sqlrooms/*/dist/**/*.js',
  ],
} satisfies Config;

export default config;
