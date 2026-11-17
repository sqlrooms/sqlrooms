import {DetectedFileFormat, detectFileFormat} from '@sqlrooms/duckdb-core';
import {LoadFile} from '@sqlrooms/room-config';

const URL_SCHEME_RE = /^[a-z][a-z\d+.-]*:\/\//i;
const COMPRESSION_EXTENSIONS = new Set(['gz', 'gzip', 'zst', 'zstd']);
const SAFE_EXTENSION_RE = /^[a-z\d]+$/i;

/**
 * The extension to give the temporary file a browser `File` is registered
 * under, so DuckDB sees the same suffix as the original name. A URL's query
 * string and fragment are dropped, and a compression suffix keeps the
 * extension before it (`data.csv.gz` → `csv.gz`).
 *
 * @returns The suffix without a leading dot, or `''` if the name has none.
 */
export function getRegisteredFileSuffix(fileName: string): string {
  let path = fileName;
  if (URL_SCHEME_RE.test(path)) {
    path = path
      .replace(/[?#].*$/, '')
      .replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, '');
  }
  const baseName = (path.split(/[/\\]/).pop() ?? '').replace(/^\.+/, '');
  const parts = baseName.split('.');
  if (parts.length < 2) return '';
  const ext = parts[parts.length - 1]!;
  if (!SAFE_EXTENSION_RE.test(ext)) return '';
  const inner = parts.length >= 3 ? parts[parts.length - 2]! : '';
  return COMPRESSION_EXTENSIONS.has(ext.toLowerCase()) &&
    SAFE_EXTENSION_RE.test(inner)
    ? `${inner}.${ext}`
    : ext;
}

const FORMAT_READERS: Record<Exclude<DetectedFileFormat, 'arrow'>, LoadFile> = {
  csv: 'read_csv',
  json: 'read_json',
  parquet: 'read_parquet',
};

/**
 * The reader for a browser `File` whose name has no extension, from its
 * content type and first bytes. DuckDB's `auto` path relies on the extension,
 * so it cannot read such a file; `read_csv` is the fallback when nothing
 * identifies the format (it still detects delimiters, headers and types).
 *
 * @returns The reader method, or `undefined` for Arrow IPC, which has no
 * reader method and keeps the existing loading path.
 */
export function getExtensionlessFileReader(input: {
  contentType?: string;
  bytes?: Uint8Array;
}): LoadFile | undefined {
  const format = detectFileFormat(input);
  if (format === 'arrow') return undefined;
  return format ? FORMAT_READERS[format] : 'read_csv';
}
