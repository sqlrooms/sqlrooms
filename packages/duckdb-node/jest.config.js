import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  // Run tests serially to avoid issues with native DuckDB module
  maxWorkers: 1,
  // Increase timeout for native module operations
  testTimeout: 30000,
};
