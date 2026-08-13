import nodeConfig from '@sqlrooms/preset-jest/node.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    // d3-free scheme name lists — avoid pulling the full color-scales barrel in node tests
    '^@sqlrooms/color-scales/colorSchemeNames$':
      '<rootDir>/../color-scales/src/colorSchemeNames.ts',
  },
};
