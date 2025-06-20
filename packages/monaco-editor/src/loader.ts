import {loader} from '@monaco-editor/react';

export const DEFAULT_CDN_PATH =
  'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs';

export type LoaderConfig = Parameters<typeof loader.config>[0];

let configured = false;

export function configureMonacoLoader(config: LoaderConfig) {
  loader.config(config);
  configured = true;
}

export function ensureMonacoLoaderConfigured() {
  if (!configured) {
    loader.config({paths: {vs: DEFAULT_CDN_PATH}});
    configured = true;
  }
}
