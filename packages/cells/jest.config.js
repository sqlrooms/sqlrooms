import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...(nodeConfig.moduleNameMapper ?? {}),
    '^monaco-editor(.*)$': '<rootDir>/__tests__/mocks/monaco-editor.js',
    '^@sqlrooms/sql-editor$': '<rootDir>/__tests__/mocks/sql-editor.js',
    '^react-mosaic-component$':
      '<rootDir>/__tests__/mocks/react-mosaic-component.js',
    '^rdndmb-html5-to-touch$':
      '<rootDir>/__tests__/mocks/rdndmb-html5-to-touch.js',
    '\\.(css|less|sass|scss)$': '<rootDir>/__tests__/mocks/style.js',
  },
};
