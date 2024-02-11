// See https://github.com/bakeruk/modern-typescript-monorepo-example/blob/main/package.json
/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
};
