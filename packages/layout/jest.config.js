import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '^@sqlrooms/layout-config$': '<rootDir>/../layout-config/src/index.ts',
  },
};
