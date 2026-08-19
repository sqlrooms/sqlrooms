import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  projects: [
    {
      ...nodeConfig,
      displayName: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
    },
    {
      ...nodeConfig,
      displayName: 'react',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
    },
  ],
};
