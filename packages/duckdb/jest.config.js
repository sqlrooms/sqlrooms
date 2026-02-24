import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '^\\./connectors/createDuckDbConnector$':
      '<rootDir>/test/__mocks__/createDuckDbConnector.ts',
  },
};
