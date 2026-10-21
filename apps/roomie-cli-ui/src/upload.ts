import {authorizedFetch} from './auth';

/** Authenticated fetch shape used by the browser upload flow. */
export type UploadFetcher = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

function validateServerPath(value: unknown): string {
  if (typeof value !== 'string' || !value)
    throw new Error('Upload returned an invalid server path.');
  const normalized = value.replace(/\\/g, '/');
  if (normalized.split('/').includes('..'))
    throw new Error('Upload returned an invalid server path.');
  return normalized;
}

/** Upload browser bytes for preview and import without creating a database table. */
export async function stageBrowserFile(
  file: File,
  fetcher: UploadFetcher = authorizedFetch,
  signal?: AbortSignal,
): Promise<string> {
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await fetcher('/api/upload', {method: 'POST', body, signal});
  const result = (await response.json().catch(() => ({}))) as {path?: unknown};
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  return validateServerPath(result.path);
}
