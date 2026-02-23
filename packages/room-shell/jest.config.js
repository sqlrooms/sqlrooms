import baseConfig from '@sqlrooms/preset-jest/base.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  testEnvironment: 'jsdom',
};