import baseConfig, {resolveJestEnvironment} from './base.js';

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...baseConfig,
  // Absolute path, not 'jsdom' — see resolveJestEnvironment. This one happens to
  // resolve to a matching major in the known nested install, but by luck.
  testEnvironment: resolveJestEnvironment('jest-environment-jsdom'),
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/test/__mocks__/fileMock.js',
  },
};
