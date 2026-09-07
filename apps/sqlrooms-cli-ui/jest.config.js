import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('jest').Config} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '^@sqlrooms/duckdb-node$':
      '<rootDir>/../../packages/duckdb-node/src/index.ts',
    '^@sqlrooms/evals$': '<rootDir>/../../packages/evals/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.app.json',
        useESM: true,
      },
    ],
  },
};
