import base from '@sqlrooms/preset-typedoc/typedoc-base-config.js';

/** @type {import('typedoc').TypeDocOptions} */
const config = {
  ...base,
  entryPoints: ['src/index.ts'],
};

export default config;

