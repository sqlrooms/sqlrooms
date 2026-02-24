import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    '^@sqlrooms/duckdb$': '<rootDir>/test/__mocks__/duckdb.ts',
    '^@sqlrooms/utils$': '<rootDir>/test/__mocks__/utils.ts',
    '^@paralleldrive/cuid2$': '<rootDir>/test/__mocks__/cuid2.ts',
    '^d3-dsv$': '<rootDir>/test/__mocks__/d3-dsv.ts',
    ...nodeConfig.moduleNameMapper,
  },
};
