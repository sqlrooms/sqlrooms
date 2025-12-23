import {config as baseConfig} from '@sqlrooms/preset-eslint/react-internal';

/** @type {import("eslint").Linter.Config} */
export default [
  ...baseConfig,
  {
    rules: {
      // Allow unused vars in this package (often useful for staged refactors and
      // intentionally-unused params in callback signatures).
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
