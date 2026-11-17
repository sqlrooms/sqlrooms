/**
 * File formats that {@link detectFileFormat} can identify. Each one maps to a
 * DuckDB reader: `read_csv` (which also detects TSV and other delimiters),
 * `read_json` (which also detects NDJSON), `read_parquet`, or Arrow IPC.
 */
export type DetectedFileFormat = 'csv' | 'json' | 'parquet' | 'arrow';

/**
 * Input for {@link detectFileFormat}. Every field is optional; pass whatever
 * is known about the file.
 */
export type DetectFileFormatInput = {
  /**
   * File name, path or URL. For URLs (anything with a `scheme://` prefix) the
   * query string and fragment are ignored, so
   * `https://host/data.parquet?X-Amz-Signature=…` is identified as Parquet.
   */
  fileName?: string;
  /**
   * MIME type of the file, e.g. the `Content-Type` of an HTTP response or
   * `File.type`. Parameters such as `; charset=utf-8` are ignored. Generic
   * types like `application/octet-stream` and `text/plain` identify nothing.
   */
  contentType?: string | null;
  /** The first bytes of the file. A few KiB is plenty. */
  bytes?: Uint8Array | ArrayBuffer;
};

const EXTENSION_FORMATS = new Map<string, DetectedFileFormat>([
  ['csv', 'csv'],
  ['tsv', 'csv'],
  ['tab', 'csv'],
  ['json', 'json'],
  ['ndjson', 'json'],
  ['jsonl', 'json'],
  ['parquet', 'parquet'],
  ['parq', 'parquet'],
  ['pq', 'parquet'],
  ['arrow', 'arrow'],
  ['feather', 'arrow'],
  ['ipc', 'arrow'],
]);

/**
 * Compression suffixes DuckDB decompresses transparently. It does so for CSV
 * and JSON only, so `data.csv.gz` is CSV but `data.parquet.gz` is unknown.
 */
const COMPRESSION_EXTENSIONS = new Set(['gz', 'gzip', 'zst', 'zstd']);
const COMPRESSIBLE_FORMATS = new Set<DetectedFileFormat>(['csv', 'json']);

const CONTENT_TYPE_FORMATS = new Map<string, DetectedFileFormat>([
  ['text/csv', 'csv'],
  ['application/csv', 'csv'],
  ['text/tab-separated-values', 'csv'],
  ['application/json', 'json'],
  ['text/json', 'json'],
  ['application/x-ndjson', 'json'],
  ['application/ndjson', 'json'],
  ['application/jsonl', 'json'],
  ['application/x-jsonlines', 'json'],
  ['application/jsonlines', 'json'],
  ['application/vnd.apache.parquet', 'parquet'],
  ['application/x-parquet', 'parquet'],
  ['application/parquet', 'parquet'],
  ['application/vnd.apache.arrow.file', 'arrow'],
  ['application/vnd.apache.arrow.stream', 'arrow'],
]);

const URL_SCHEME_RE = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Identifies which DuckDB reader fits a file, for when its name alone doesn't
 * tell (e.g. a URL with no extension). It only picks the reader: delimiters,
 * headers, column types and JSON layouts are left to DuckDB's own detection.
 *
 * Checks, in order:
 * 1. the extension of `fileName` (ignoring a URL's query string and fragment;
 *    `.gz`/`.zst` is looked through for CSV and JSON);
 * 2. `contentType`;
 * 3. the leading `bytes`: `PAR1` is Parquet, `ARROW1` (or an Arrow IPC stream
 *    continuation marker) is Arrow, and a first non-whitespace `[` or `{` is
 *    JSON.
 *
 * Pure and synchronous, so apps can call it, e.g. to preview a format.
 *
 * @returns The identified format, or `undefined` when nothing identifies it.
 * Unknown formats may still be readable by DuckDB or one of its extensions,
 * so `undefined` means "keep DuckDB's own loading path", not "unsupported".
 *
 * @example
 * ```ts
 * detectFileFormat({fileName: 'https://host/data.parquet?sig=abc'}); // 'parquet'
 * detectFileFormat({fileName: 'export', contentType: 'text/csv'}); // 'csv'
 * detectFileFormat({bytes: new Uint8Array(await file.slice(0, 4096).arrayBuffer())});
 * ```
 */
export function detectFileFormat(
  input: DetectFileFormatInput,
): DetectedFileFormat | undefined {
  const {fileName, contentType, bytes} = input;
  return (
    (fileName ? getFormatFromFileName(fileName) : undefined) ??
    (contentType ? getFormatFromContentType(contentType) : undefined) ??
    (bytes
      ? getFormatFromBytes(
          bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
        )
      : undefined)
  );
}

/**
 * Format from the extension of the last path segment. URLs lose their query
 * string, fragment and host first, so `https://example.com` has no extension.
 */
function getFormatFromFileName(
  fileName: string,
): DetectedFileFormat | undefined {
  let path = fileName;
  if (URL_SCHEME_RE.test(path)) {
    path = path
      .replace(/[?#].*$/, '')
      .replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, '');
  }
  const baseName = path.split(/[/\\]/).pop() ?? '';
  const parts = baseName.toLowerCase().split('.');
  if (parts.length < 2) return undefined;
  const ext = parts.pop()!;
  if (COMPRESSION_EXTENSIONS.has(ext)) {
    const inner =
      parts.length >= 2 ? EXTENSION_FORMATS.get(parts.pop()!) : undefined;
    return inner && COMPRESSIBLE_FORMATS.has(inner) ? inner : undefined;
  }
  return EXTENSION_FORMATS.get(ext);
}

function getFormatFromContentType(
  contentType: string,
): DetectedFileFormat | undefined {
  const mimeType = contentType.split(';')[0]!.trim().toLowerCase();
  return CONTENT_TYPE_FORMATS.get(mimeType);
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

function getFormatFromBytes(bytes: Uint8Array): DetectedFileFormat | undefined {
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
  return first === 0x5b /* [ */ || first === 0x7b /* { */ ? 'json' : undefined;
}
