import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...(nodeConfig.moduleNameMapper ?? {}),
    '^@sqlrooms/duckdb-core$': '<rootDir>/__tests__/helpers/duckdb-core.ts',
  },
};
