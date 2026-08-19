import nodeConfig from '@sqlrooms/preset-jest/node.js';
import reactConfig from '@sqlrooms/preset-jest/react.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  projects: [
    {
      ...nodeConfig,
      displayName: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
    },
    {
      ...reactConfig,
      displayName: 'react',
      testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
    },
  ],
};
