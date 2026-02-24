import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    '^\\./connectors/createDuckDbConnector(\\.js)?$':
      '<rootDir>/test/__mocks__/createDuckDbConnector.ts',
    ...nodeConfig.moduleNameMapper,
  },
};
