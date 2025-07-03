import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const preset = sqlroomsTailwindPreset({prefix: ''});
const config = {
  ...preset,
  content: [
    'src/**/*.{ts,tsx}',
    // @sqlrooms-packages-content-start
    // !IMPORTANT! Replace the following by
    //             when not developing sqlrooms in the monorepo
    '../../packages/*/src/**/*.{ts,tsx}',
    // @sqlrooms-packages-content-end
  ],
  theme: {
    ...preset.theme,
    extend: {
      ...preset.theme?.extend,
    },
  },
} satisfies Config;

export default config;
