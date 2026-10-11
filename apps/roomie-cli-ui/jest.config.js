import nodeConfig from '@sqlrooms/preset-jest/node.js';
import {createRequire} from 'node:module';

const requireFromPreset = createRequire(
  import.meta.resolve('@sqlrooms/preset-jest/node.js'),
);

/** @type {import('jest').Config} */
export default {
  ...nodeConfig,
  moduleNameMapper: {
    ...nodeConfig.moduleNameMapper,
    '\\.(css|less|sass|scss)$': requireFromPreset.resolve('identity-obj-proxy'),
    '^@sqlrooms/mcp/room$': '<rootDir>/../../packages/mcp/src/room.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {tsconfig: 'tsconfig.json', useESM: true}],
  },
};
