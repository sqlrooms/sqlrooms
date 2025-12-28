// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
export default {
  ignores: ['apps/**', 'packages/**'],
  extends: ['@sqlrooms/preset-eslint/library.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
