import nodeConfig from '@sqlrooms/preset-jest/node.js';
import {resolveJestEnvironment} from '@sqlrooms/preset-jest/base.js';

const sharedConfig = {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    // d3-free scheme name lists — avoid pulling the full color-scales barrel in node tests
    '^@sqlrooms/color-scales/colorSchemeNames$':
      '<rootDir>/../color-scales/src/colorSchemeNames.ts',
  },
};

/** @type {import('jest').Config} */
export default {
  projects: [
    {
      ...sharedConfig,
      displayName: 'node',
      testMatch: ['**/__tests__/**/*.test.ts'],
    },
    {
      ...sharedConfig,
      displayName: 'react',
      testEnvironment: resolveJestEnvironment('jest-environment-jsdom'),
      testEnvironmentOptions: {customExportConditions: ['browser']},
      setupFiles: ['<rootDir>/test/setup-dom.ts'],
      testMatch: ['**/__tests__/**/*.test.tsx'],
    },
  ],
};
