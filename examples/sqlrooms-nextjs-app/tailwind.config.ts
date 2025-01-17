import {sqlroomsTailwindPreset} from '@sqlrooms/ui';

import type {Config} from 'tailwindcss';
import {fontFamily} from 'tailwindcss/defaultTheme';

const preset = sqlroomsTailwindPreset({prefix: ''});
const config = {
  ...preset,
  content: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '../../packages/ui/src/components/**/*.{ts,tsx}',
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
