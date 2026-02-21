import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...(nodeConfig.moduleNameMapper ?? {}),
    '^monaco-editor(.*)$': '<rootDir>/__tests__/mocks/monaco-editor.js',
    '^@sqlrooms/sql-editor$': '<rootDir>/__tests__/mocks/sql-editor.js',
    '^@openassistant/utils$':
      '<rootDir>/__tests__/mocks/openassistant-utils.js',
  },
};
