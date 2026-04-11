import nodeConfig from '@sqlrooms/preset-jest/node.js';

export default {
  ...nodeConfig,
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
