import {
  convertToValidColumnOrTableName,
  generateUniqueName,
  splitFilePath,
} from '@sqlrooms/utils';
import {authorizedFetch} from './auth';
import {stageBrowserFile} from './upload';
import {connector, roomStore} from './store';

/** File formats supported by Roomie's data import UI. */
export type DataFileFormat = 'csv' | 'parquet' | 'json';
/** A source chosen by the user for inspection or immediate import. */
export type DataImportSource =
  | {kind: 'file'; file: File}
  | {kind: 'path'; path: string}
  | {kind: 'url'; url: string; format: DataFileFormat};
/** Resolved source shared by the preview and the final import. */
export type PreparedDataImport = {query: string; path?: string};

/** Infer the reader from a filename, including compressed files and URL queries. */
export function inferDataFileFormat(name: string): DataFileFormat | undefined {
  const pathname = /^https?:\/\//i.test(name) ? new URL(name).pathname : name;
  const extension = pathname
    .replace(/\.(gz|zst)$/i, '')
    .split('.')
    .pop()
    ?.toLowerCase();
  if (extension === 'csv' || extension === 'parquet') return extension;
  if (['json', 'jsonl', 'ndjson'].includes(extension ?? '')) return 'json';
  return undefined;
}

/** Generate a default name without colliding with an existing visible table. */
export function suggestImportTableName(
  name: string,
  existingNames: string[],
): string {
  let pathname = name;
  if (/^https?:\/\//i.test(name)) {
    try {
      pathname = decodeURIComponent(new URL(name).pathname);
    } catch {
      return 'imported_data';
    }
  }
  const {filename} = splitFilePath(pathname.replace(/\.(gz|zst)$/i, ''));
  return generateUniqueName(
    convertToValidColumnOrTableName(filename) || 'imported_data',
    existingNames,
  );
}

/** Construct one escaped reader query; URL imports accept only HTTP(S). */
export function dataFileQuery(
  path: string,
  format: DataFileFormat,
  remote = false,
): string {
  if (remote) {
    const url = new URL(path);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error(
        'Use an HTTP or HTTPS file URL without embedded credentials.',
      );
    if (/[\[\]*]/.test(url.pathname))
      throw new Error('Use a URL for a single file, without wildcards.');
  } else if (/[?*[\]]/.test(path)) {
    throw new Error(
      'File paths containing wildcard characters are not supported.',
    );
  }
  const reader = {
    csv: 'read_csv_auto',
    parquet: 'read_parquet',
    json: 'read_json_auto',
  }[format];
  return `SELECT * FROM ${reader}('${path.replace(/'/g, "''")}')`;
}

/** Resolve or upload a source without creating a table in the workspace. */
export async function prepareDataImport(
  source: DataImportSource,
  signal?: AbortSignal,
): Promise<PreparedDataImport> {
  if (source.kind === 'url')
    return {query: dataFileQuery(source.url.trim(), source.format, true)};
  const path =
    source.kind === 'file'
      ? await stageBrowserFile(source.file, authorizedFetch, signal)
      : source.path.trim();
  const response = await authorizedFetch('/api/local-file', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({path}),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message ?? 'Could not read the file.');
  if (
    typeof result.path !== 'string' ||
    !['csv', 'parquet', 'json'].includes(result.format)
  )
    throw new Error('The server returned an invalid file source.');
  return {path: result.path, query: dataFileQuery(result.path, result.format)};
}

/** Read a bounded sample for inspection; no workspace table is created. */
export async function previewDataImport(
  source: PreparedDataImport,
  signal?: AbortSignal,
) {
  return await connector.query(`${source.query} LIMIT 100`, {signal});
}

/** Materialize the complete source through the same commands available to agents. */
export async function commitDataImport(
  source: PreparedDataImport,
  tableName: string,
) {
  const result = await roomStore
    .getState()
    .commands.invokeCommand(
      source.path ? 'db.import-file' : 'db.create-table-from-query',
      source.path
        ? {path: source.path, tableName}
        : {query: source.query, tableName},
      {surface: 'palette'},
    );
  if (!result.success)
    throw new Error(result.error ?? 'Could not import the file.');
}
