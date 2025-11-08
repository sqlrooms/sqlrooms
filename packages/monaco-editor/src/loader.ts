import {loader} from '@monaco-editor/react';
import * as Monaco from 'monaco-editor';

export interface LoaderWorkers {
  /** worker used when label does not match other workers */
  default?: {new (): Worker};
  [label: string]: {new (): Worker} | undefined;
}

export const DEFAULT_CDN_PATH =
  'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs';

export type LoaderConfig = Parameters<typeof loader.config>[0];

export interface MonacoLoaderOptions extends LoaderConfig {
  /**
   * Pass the Monaco instance to bundle the editor instead of using a CDN
   */
  monaco?: any;
  /**
   * Provide worker constructors mapped by label to automatically set
   * `self.MonacoEnvironment.getWorker`
   */
  workers?: LoaderWorkers;
}

let configured = false;

/**
 * Checks if the Monaco loader has been configured for bundling.
 * When true, Monaco is bundled with the app instead of loaded from CDN.
 */
export function isMonacoLoaderConfigured(): boolean {
  return configured;
}

/**
 * Configures the Monaco loader for bundling Monaco with your application.
 * Call this once at app startup to enable offline use across all editor components.
 *
 * After calling this, all MonacoEditor components will automatically use the bundled version
 * without needing the `bundleMonaco` prop.
 *
 * @example
 * ```ts
 * import {configureMonacoLoader} from '@sqlrooms/monaco-editor';
 * import * as monaco from 'monaco-editor';
 * import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
 *
 * configureMonacoLoader({
 *   monaco,
 *   workers: { default: editorWorker }
 * });
 * ```
 */
export function configureMonacoLoader(options: MonacoLoaderOptions) {
  const {workers, ...config} = options;
  loader.config(config);

  if (workers) {
    self.MonacoEnvironment = {
      getWorker(_: unknown, label: string) {
        const WorkerCtor = workers[label] || workers.default || undefined;
        return WorkerCtor ? new WorkerCtor() : (undefined as any);
      },
    } as any;
  }

  configured = true;
}

export function ensureMonacoLoaderConfigured() {
  if (!configured) {
    if (typeof window !== 'undefined') {
      loader.config({monaco: Monaco});
    }
    configured = true;
  }
}
