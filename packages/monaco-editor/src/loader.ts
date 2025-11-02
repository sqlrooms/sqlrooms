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
    // Prefer bundling the local monaco-editor to avoid CDN/version mismatches
    // Consumers can still override via configureMonacoLoader if needed
    if (typeof window !== 'undefined') {
      loader.config({paths: {vs: DEFAULT_CDN_PATH}});
    }
    configured = true;
  }
}
