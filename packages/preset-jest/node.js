import baseConfig from './base.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  testEnvironment: 'node',
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
};
