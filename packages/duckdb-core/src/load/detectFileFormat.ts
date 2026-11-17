/**
 * Tabular file formats that {@link detectFileFormat} can recognize.
 */
export type DetectedFileFormat =
  | 'csv'
  | 'tsv'
  | 'json'
  | 'ndjson'
  | 'parquet'
  | 'arrow';

/**
 * Input for {@link detectFileFormat}. Every field is optional; pass whatever
 * is known about the file.
 */
export type DetectFileFormatInput = {
  /**
   * File name, path or URL. For URLs (anything with a `scheme://` prefix) the
   * query string and fragment are ignored, so
   * `https://host/data.parquet?X-Amz-Signature=…` is detected as Parquet.
   */
  fileName?: string;
  /**
   * MIME type of the file, e.g. the `Content-Type` of an HTTP response or
   * `File.type`. Parameters such as `; charset=utf-8` are ignored. Generic
   * types like `application/octet-stream` and `text/plain` are skipped.
   */
  contentType?: string | null;
  /**
   * The first bytes of the file. The first few KiB are enough; for NDJSON
   * detection they must include the whole first line.
   */
  bytes?: Uint8Array | ArrayBuffer;
};

const EXTENSION_FORMATS: Record<string, DetectedFileFormat> = {
  csv: 'csv',
  tsv: 'tsv',
  tab: 'tsv',
  json: 'json',
  ndjson: 'ndjson',
  jsonl: 'ndjson',
  parquet: 'parquet',
  parq: 'parquet',
  pq: 'parquet',
  arrow: 'arrow',
  feather: 'arrow',
  ipc: 'arrow',
};

/** Compression suffixes that are skipped to find the inner extension. */
const COMPRESSION_EXTENSIONS = new Set(['gz', 'gzip', 'zst', 'zstd']);

const CONTENT_TYPE_FORMATS: Record<string, DetectedFileFormat> = {
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/json': 'json',
  'text/json': 'json',
  'application/x-ndjson': 'ndjson',
  'application/ndjson': 'ndjson',
  'application/jsonl': 'ndjson',
  'application/x-jsonlines': 'ndjson',
  'application/jsonlines': 'ndjson',
  'application/vnd.apache.parquet': 'parquet',
  'application/x-parquet': 'parquet',
  'application/parquet': 'parquet',
  'application/vnd.apache.arrow.file': 'arrow',
  'application/vnd.apache.arrow.stream': 'arrow',
};

const URL_SCHEME_RE = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Detects the format of a tabular data file.
 *
 * Checks, in order:
 * 1. the extension of `fileName` (ignoring a URL's query string and fragment,
 *    and a trailing `.gz`/`.zst` compression suffix);
 * 2. `contentType`;
 * 3. the leading `bytes`: `PAR1` is Parquet, `ARROW1` (or an Arrow IPC stream
 *    continuation marker) is Arrow, a first non-whitespace `[` or `{` is JSON
 *    (NDJSON when the first line is a complete object followed by a newline),
 *    and anything else is CSV.
 *
 * Pure and synchronous, so apps can call it to preview a format before
 * loading.
 *
 * @returns The detected format, or `undefined` when neither the name nor the
 * content type is recognized and no bytes were given. When `bytes` are given,
 * a format is always returned (CSV is the fallback).
 *
 * @example
 * ```ts
 * detectFileFormat({fileName: 'https://host/data.parquet?sig=abc'}); // 'parquet'
 * detectFileFormat({fileName: 'export', contentType: 'text/csv'}); // 'csv'
 * detectFileFormat({bytes: new Uint8Array(await file.slice(0, 65536).arrayBuffer())});
 * ```
 */
export function detectFileFormat(
  input: DetectFileFormatInput,
): DetectedFileFormat | undefined {
  const {fileName, contentType, bytes} = input;

  if (fileName) {
    const ext = getFileExtension(fileName);
    const format = ext ? EXTENSION_FORMATS[ext] : undefined;
    if (format) return format;
  }

  if (contentType) {
    const mimeType = contentType.split(';')[0]!.trim().toLowerCase();
    const format = CONTENT_TYPE_FORMATS[mimeType];
    if (format) return format;
  }

  if (bytes) {
    return detectFormatFromBytes(
      bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    );
  }

  return undefined;
}

/**
 * Lower-cased extension of the last path segment, skipping compression
 * suffixes (`data.csv.gz` → `csv`). URLs lose their query string, fragment
 * and host first, so `https://example.com` has no extension.
 */
function getFileExtension(fileName: string): string | undefined {
  let path = fileName;
  if (URL_SCHEME_RE.test(path)) {
    path = path
      .replace(/[?#].*$/, '')
      .replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, '');
  }
  const baseName = path.split(/[/\\]/).pop() ?? '';
  const parts = baseName.toLowerCase().split('.');
  if (parts.length < 2) return undefined;
  let ext = parts.pop();
  if (ext && COMPRESSION_EXTENSIONS.has(ext) && parts.length >= 2) {
    ext = parts.pop();
  }
  return ext || undefined;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return (
    bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b)
  );
}

const PARQUET_MAGIC = [0x50, 0x41, 0x52, 0x31]; // PAR1
const ARROW_FILE_MAGIC = [0x41, 0x52, 0x52, 0x4f, 0x57, 0x31]; // ARROW1
const ARROW_STREAM_CONTINUATION = [0xff, 0xff, 0xff, 0xff];
const UTF8_BOM = [0xef, 0xbb, 0xbf];

function isWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}

function detectFormatFromBytes(bytes: Uint8Array): DetectedFileFormat {
  if (startsWith(bytes, PARQUET_MAGIC)) return 'parquet';
  if (
    startsWith(bytes, ARROW_FILE_MAGIC) ||
    startsWith(bytes, ARROW_STREAM_CONTINUATION)
  ) {
    return 'arrow';
  }

  let start = startsWith(bytes, UTF8_BOM) ? UTF8_BOM.length : 0;
  while (start < bytes.length && isWhitespace(bytes[start]!)) start++;
  const first = bytes[start];
  if (first === 0x5b /* [ */) return 'json';
  if (first === 0x7b /* { */) {
    return isFirstLineJsonObject(bytes, start) ? 'ndjson' : 'json';
  }
  return 'csv';
}

/** True when the line starting at `start` is a complete JSON object followed by a newline. */
function isFirstLineJsonObject(bytes: Uint8Array, start: number): boolean {
  const newline = bytes.indexOf(0x0a, start);
  if (newline < 0) return false;
  try {
    const line = new TextDecoder().decode(bytes.subarray(start, newline));
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}
