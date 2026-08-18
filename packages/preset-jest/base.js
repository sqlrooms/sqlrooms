import {createRequire} from 'node:module';

const requireFromPreset = createRequire(import.meta.url);

/**
 * Resolve a jest environment to an absolute path, from THIS package.
 *
 * Jest resolves a bare `testEnvironment: 'node'` from the consuming package's
 * `rootDir`. In a nested install — SQLRooms checked out inside another repo's
 * workspace — Node's upward walk can leave this workspace entirely and pick up
 * the PARENT's copy. A jest 29 environment builds a 29-era `ModuleMocker`, which
 * jest-runtime 30 then calls a 30-only method on:
 *
 *   TypeError: this._moduleMocker.clearMocksOnScope is not a function
 *
 * That took out 13 of 26 `@sqlrooms/ai-core` suites for a consumer while CI here
 * stayed green, because standalone there is no parent to shadow anything.
 * Resolving from the preset pins the version this package declares, whatever the
 * consumer's `rootDir` would have found.
 */
export function resolveJestEnvironment(name) {
  return requireFromPreset.resolve(name);
}

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
  ],
};
