import {loader} from '@monaco-editor/react';

export interface LoaderWorkers {
  /** worker used when label does not match other workers */
  default?: {new (): Worker};
  [label: string]: {new (): Worker} | undefined;
}

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

/**
 * Dynamically imports and configures Monaco for bundling (SSR-safe).
 *
 * @internal
 * This is an advanced utility that most users don't need.
 * Use `configureMonacoLoader()` at app startup instead for better control.
 *
 * This function:
 * - Only runs on the client side (checks typeof window)
 * - Dynamically imports monaco-editor to avoid SSR issues in Next.js
 * - Automatically configures the loader with the imported Monaco instance
 *
 * When to use:
 * - You need Monaco bundled but can't call configureMonacoLoader at app startup
 * - You're working in an environment where top-level imports of monaco-editor fail
 *
 * When NOT to use:
 * - For normal bundling, use `configureMonacoLoader()` at app startup
 * - For CDN loading, just use the component - no configuration needed
 */
export async function ensureMonacoLoaderConfigured() {
  if (!configured && typeof window !== 'undefined') {
    const Monaco = await import('monaco-editor');
    loader.config({monaco: Monaco});
    configured = true;
  }
}
