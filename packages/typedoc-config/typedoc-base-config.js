import {dirname, basename} from 'path';
import {fileURLToPath} from 'url';
/** @type {Partial<import("typedoc").TypeDocOptions>} */
const typedocOptions = {
  classPropertiesFormat: 'table',
  cleanOutputDir: true,
  disableSources: true,
  disableSources: true,
  entryPoints: ['src/index.ts'],
  entryPointStrategy: 'resolve',
  enumMembersFormat: 'table',
  exclude: ['**/node_modules', '**/dist'],
  excludeExternals: true,
  excludePrivate: true,
  excludeProtected: true,
  excludeScopesInPaths: true,
  fileExtension: '.md',
  // hideBreadcrumbs: true,
  // hidePageHeader: true,
  // out: './docs',
  parametersFormat: 'table',
  plugin: [
    'typedoc-plugin-markdown',
    'typedoc-vitepress-theme',
    'typedoc-plugin-zod',
  ],
  propertyMembersFormat: 'table',
  readme: 'none',
  sanitizeComments: true,
  sort: ['source-order'],
  tsconfig: 'tsconfig.json',
  typeDeclarationFormat: 'table',
  typeDeclarationVisibility: 'compact',
};

/** @type {(options: Partial<import("typedoc").TypeDocOptions>) => Partial<import("typedoc").TypeDocOptions>} */
export default function defaultConfig(importMetaUrl, options) {
  return {
    ...typedocOptions,
    ...options,
    ...(importMetaUrl
      ? {
          out: `../../docs/api/${basename(dirname(fileURLToPath(importMetaUrl)))}`,
        }
      : {}),
  };
}
