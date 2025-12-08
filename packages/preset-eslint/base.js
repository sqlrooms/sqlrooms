import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
// import onlyWarn from 'eslint-plugin-only-warn';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-unused-vars': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sqlrooms/*/**', '!@sqlrooms/preset-*/**'],
              message:
                "Only import from '@sqlrooms/<package>', not subpaths like '@sqlrooms/<package>/...'",
            },
          ],
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sqlrooms/*/**', '!@sqlrooms/preset-*/**'],
              message:
                "Only import from '@sqlrooms/<package>', not subpaths like '@sqlrooms/<package>/...'",
            },
          ],
        },
      ],
    },
  },
  {
    plugins: {
      // onlyWarn,
    },
  },
  {
    ignores: ['dist/**'],
  },
];
