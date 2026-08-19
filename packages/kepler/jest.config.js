/* global process */

import nodeConfig from '@sqlrooms/preset-jest/node.js';

const nodeMajorVersion = Number(process.versions.node.split('.')[0]);
const keplerCjsMapper =
  nodeMajorVersion >= 24
    ? {
        '^@kepler\\.gl/components/(.*)$':
          '<rootDir>/node_modules/@kepler.gl/components/dist/cjs/$1.js',
        '^@kepler\\.gl/(actions|components|constants|duckdb|layers|localization|processors|reducers|schemas|styles|table|types|utils)$':
          '<rootDir>/node_modules/@kepler.gl/$1/dist/cjs/index.js',
      }
    : {};

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '\\.(css|less|sass|scss)$':
      '<rootDir>/node_modules/identity-obj-proxy/src/index.js',
    // Jest 30 on Node 24 misclassifies Kepler's unmarked ESM .js files as CJS.
    ...keplerCjsMapper,
    '^global/window$': '<rootDir>/__tests__/mocks/globalWindow.cjs',
    '^styled-components$': '<rootDir>/__tests__/mocks/styledComponents.cjs',
  },
};
