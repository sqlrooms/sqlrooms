/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {MonacoEditor} from './components/MonacoEditor';
export type {MonacoEditorProps} from './components/MonacoEditor';

export {
  configureMonacoLoader,
  type LoaderConfig,
  type MonacoLoaderOptions,
  type LoaderWorkers,
  DEFAULT_CDN_PATH,
  ensureMonacoLoaderConfigured,
} from './loader';

export {JsonMonacoEditor} from './components/JsonMonacoEditor';
export type {JsonMonacoEditorProps} from './components/JsonMonacoEditor';

// Export utility functions
export {getCssColor, hslToHex, getMonospaceFont} from './utils/color-utils';
