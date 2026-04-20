/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {MonacoEditor} from './components/MonacoEditor';
export type {MonacoEditorProps} from './components/MonacoEditor';

export {
  configureMonacoLoader,
  isMonacoLoaderConfigured,
  ensureMonacoLoaderConfigured,
  type LoaderConfig,
  type MonacoLoaderOptions,
  type LoaderWorkers,
} from './loader';

export {JsonMonacoEditor} from './components/JsonMonacoEditor';
export type {JsonMonacoEditorProps} from './components/JsonMonacoEditor';

export {MarkdownMonacoEditor} from './components/MarkdownMonacoEditor';
export type {MarkdownMonacoEditorProps} from './components/MarkdownMonacoEditor';
