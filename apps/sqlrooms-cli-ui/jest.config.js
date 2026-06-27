import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('jest').Config} */
export default {
  ...nodeConfig,
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
