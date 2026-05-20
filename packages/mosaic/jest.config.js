import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...(nodeConfig.moduleNameMapper ?? {}),
    '\\.(css|less|sass|scss)$': '<rootDir>/__tests__/mocks/style.js',
  },
  setupFilesAfterEnv: [
    ...(nodeConfig.setupFilesAfterEnv ?? []),
    '<rootDir>/test/setup.ts',
  ],
};
