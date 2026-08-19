import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '^global/window$': '<rootDir>/__tests__/mocks/globalWindow.js',
    '^styled-components$': '<rootDir>/__tests__/mocks/styledComponents.js',
  },
};
