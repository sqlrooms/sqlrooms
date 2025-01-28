import {sqlroomsTailwindPreset} from '@sqlrooms/ui';

import type {Config} from 'tailwindcss';
import {fontFamily} from 'tailwindcss/defaultTheme';

const preset = sqlroomsTailwindPreset({prefix: ''});
const config = {
  ...preset,
  content: [
    '{app,components,hooks,store,lib}/**/*.{ts,tsx}',
    // @sqlrooms-packages-content-start
    '../../packages/*/src/**/*.{ts,tsx}',
    // @sqlrooms-packages-content-end
  ],
  theme: {
    ...preset.theme,
    extend: {
      ...preset.theme?.extend,
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        mono: ['var(--font-mono)', ...fontFamily.mono],
      },
    },
  },
} satisfies Config;

export default config;
