import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  setupFilesAfterEnv: [
    ...(nodeConfig.setupFilesAfterEnv ?? []),
    '<rootDir>/test/setup.ts',
  ],
};
