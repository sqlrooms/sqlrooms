import type {DuckDbConnector} from '@sqlrooms/duckdb';
import {authorizedFetch} from './auth';

const SAFE_SERVER_PATH_RE = /^[A-Za-z0-9_\-./:\\]+$/;

/** Authenticated fetch shape used by the browser upload flow. */
export type UploadFetcher = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

function validateServerPath(value: unknown): string {
  if (typeof value !== 'string' || !value || !SAFE_SERVER_PATH_RE.test(value))
    throw new Error('Upload returned an invalid server path.');
  const normalized = value.replace(/\\/g, '/');
  if (normalized.split('/').includes('..'))
    throw new Error('Upload returned an invalid server path.');
  return normalized;
}

/** Upload browser bytes before asking the remote DuckDB connector to import them. */
export async function uploadBrowserFile(
  file: File,
  tableName: string,
  connector: Pick<DuckDbConnector, 'loadFile'>,
  fetcher: UploadFetcher = authorizedFetch,
): Promise<void> {
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await fetcher('/api/upload', {method: 'POST', body});
  const result = (await response.json().catch(() => ({}))) as {path?: unknown};
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  await connector.loadFile(validateServerPath(result.path), tableName);
}
