import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    '^@duckdb/duckdb-wasm$': '<rootDir>/test/__mocks__/duckdb-wasm.ts',
    '^@sqlrooms/room-store$': '<rootDir>/test/__mocks__/room-store.ts',
    '^\\./connectors/createDuckDbConnector(\\.js)?$':
      '<rootDir>/test/__mocks__/createDuckDbConnector.ts',
    ...nodeConfig.moduleNameMapper,
  },
};
