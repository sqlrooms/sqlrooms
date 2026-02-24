import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    '^@sqlrooms/duckdb$': '<rootDir>/test/__mocks__/duckdb.ts',
    '^@paralleldrive/cuid2$': '<rootDir>/test/__mocks__/cuid2.ts',
    ...nodeConfig.moduleNameMapper,
  },
};
