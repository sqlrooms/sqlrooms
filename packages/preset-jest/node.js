import baseConfig, {resolveJestEnvironment} from './base.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  // Absolute path, not 'node' — see resolveJestEnvironment.
  testEnvironment: resolveJestEnvironment('jest-environment-node'),
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
};
