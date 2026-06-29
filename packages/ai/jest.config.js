import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...(nodeConfig.moduleNameMapper ?? {}),
    '^@sqlrooms/duckdb-core$': '<rootDir>/../duckdb-core/src/index.ts',
  },
};
