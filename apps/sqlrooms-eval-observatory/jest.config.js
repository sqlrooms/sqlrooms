import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('jest').Config} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '^@sqlrooms/evals/promptfoo/read-model$':
      '<rootDir>/../../packages/evals/src/promptfoo/readModel.ts',
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
