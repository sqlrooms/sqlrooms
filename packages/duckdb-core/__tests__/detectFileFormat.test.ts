import {detectFileFormat} from '../src/load/detectFileFormat';

const text = (s: string) => new TextEncoder().encode(s);

describe('detectFileFormat', () => {
  describe('extension', () => {
    it.each([
      ['data.csv', 'csv'],
      ['data.TSV', 'csv'],
      ['data.json', 'json'],
      ['data.ndjson', 'json'],
      ['data.jsonl', 'json'],
      ['data.parquet', 'parquet'],
      ['data.arrow', 'arrow'],
      ['data.feather', 'arrow'],
      ['path/to/data.csv.gz', 'csv'],
      ['data.json.zst', 'json'],
      ['C:\\Users\\me\\data.parquet', 'parquet'],
    ])('detects %s as %s', (fileName, format) => {
      expect(detectFileFormat({fileName})).toBe(format);
    });

    it('detects URLs without a query string', () => {
      expect(
        detectFileFormat({fileName: 'https://example.com/a/b/data.parquet'}),
      ).toBe('parquet');
      expect(detectFileFormat({fileName: 's3://bucket/key/data.csv'})).toBe(
        'csv',
      );
    });

    it('ignores the query string and fragment of a URL', () => {
      expect(
        detectFileFormat({
          fileName:
            'https://bucket.s3.amazonaws.com/data.parquet?X-Amz-Signature=abc.csv&x=1',
        }),
      ).toBe('parquet');
      expect(
        detectFileFormat({fileName: 'https://example.com/data.json#rows.csv'}),
      ).toBe('json');
    });

    it('does not read the host as an extension', () => {
      expect(detectFileFormat({fileName: 'https://example.csv'})).toBe(
        undefined,
      );
    });

    it('keeps ? and # in local file names', () => {
      // Not a URL, so "#" is part of the name and the extension is "csv".
      expect(detectFileFormat({fileName: 'report #1.csv'})).toBe('csv');
    });

    it('does not look through compression for binary formats', () => {
      // DuckDB only decompresses CSV and JSON transparently.
      expect(detectFileFormat({fileName: 'data.parquet.gz'})).toBe(undefined);
      expect(detectFileFormat({fileName: 'data.arrow.zst'})).toBe(undefined);
      expect(detectFileFormat({fileName: 'data.gz'})).toBe(undefined);
    });

    it('prefers the extension over the content type and bytes', () => {
      expect(
        detectFileFormat({
          fileName: 'data.parquet',
          contentType: 'text/csv',
          bytes: text('[1]'),
        }),
      ).toBe('parquet');
    });

    it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
      'treats the inherited name %s as unknown and falls through',
      (name) => {
        expect(detectFileFormat({fileName: `data.${name}`})).toBe(undefined);
        expect(
          detectFileFormat({fileName: `data.${name}`, contentType: 'text/csv'}),
        ).toBe('csv');
        expect(detectFileFormat({fileName: `data.${name}.gz`})).toBe(undefined);
      },
    );
  });

  describe('content type', () => {
    it.each([
      ['text/csv', 'csv'],
      ['text/csv; charset=utf-8', 'csv'],
      ['text/tab-separated-values', 'csv'],
      ['application/json', 'json'],
      ['application/x-ndjson', 'json'],
      ['application/vnd.apache.parquet', 'parquet'],
      ['application/vnd.apache.arrow.file', 'arrow'],
      ['Application/Vnd.Apache.Arrow.Stream', 'arrow'],
    ])('detects %s as %s', (contentType, format) => {
      expect(
        detectFileFormat({
          fileName: 'https://api.example.com/export',
          contentType,
        }),
      ).toBe(format);
    });

    it('is used when the extension is unknown', () => {
      expect(
        detectFileFormat({fileName: 'export.php', contentType: 'text/csv'}),
      ).toBe('csv');
    });

    it('skips generic content types and falls through to bytes', () => {
      const parquet = new Uint8Array([0x50, 0x41, 0x52, 0x31, 0, 0]);
      expect(
        detectFileFormat({contentType: 'binary/octet-stream', bytes: parquet}),
      ).toBe('parquet');
      expect(
        detectFileFormat({contentType: 'text/plain', bytes: text('[1]')}),
      ).toBe('json');
    });

    it.each(['constructor', '__proto__', 'toString'])(
      'treats the inherited name %s as unknown and falls through',
      (contentType) => {
        expect(detectFileFormat({contentType})).toBe(undefined);
        expect(detectFileFormat({contentType, bytes: text('PAR1')})).toBe(
          'parquet',
        );
      },
    );
  });

  describe('magic bytes', () => {
    it('detects Parquet', () => {
      expect(detectFileFormat({bytes: text('PAR1\0\0\0')})).toBe('parquet');
    });

    it('detects Arrow IPC files and streams', () => {
      expect(detectFileFormat({bytes: text('ARROW1\0\0')})).toBe('arrow');
      expect(
        detectFileFormat({bytes: new Uint8Array([0xff, 0xff, 0xff, 0xff, 8])}),
      ).toBe('arrow');
    });

    it('accepts an ArrayBuffer', () => {
      expect(detectFileFormat({bytes: text('PAR1').buffer})).toBe('parquet');
    });

    it.each([
      ['a JSON array', '  \n[{"a": 1}]'],
      ['a pretty-printed object', '{\n  "a": 1\n}\n'],
      ['NDJSON', '{"a": 1}\n{"a": 2}\n'],
      ['a cut-off first line', '{"a": "very long'],
    ])('detects %s as JSON', (_label, content) => {
      expect(detectFileFormat({bytes: text(content)})).toBe('json');
    });

    it('ignores a UTF-8 BOM and leading whitespace', () => {
      expect(
        detectFileFormat({
          bytes: new Uint8Array([0xef, 0xbb, 0xbf, 0x20, ...text('{"a":1}')]),
        }),
      ).toBe('json');
    });
  });

  describe('unknown content', () => {
    it('returns undefined instead of assuming CSV', () => {
      expect(detectFileFormat({bytes: text('a,b\n1,2\n')})).toBe(undefined);
      expect(detectFileFormat({bytes: new Uint8Array()})).toBe(undefined);
      expect(
        detectFileFormat({
          fileName: 'https://api.example.com/export',
          contentType: 'text/plain',
          bytes: text('id;name\n1;x\n'),
        }),
      ).toBe(undefined);
    });

    it('returns undefined when nothing is known', () => {
      expect(detectFileFormat({})).toBe(undefined);
      expect(
        detectFileFormat({fileName: 'https://api.example.com/export'}),
      ).toBe(undefined);
    });

    it('returns undefined for extensions DuckDB extensions may handle', () => {
      const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP
      expect(
        detectFileFormat({
          fileName: 'data.xlsx',
          contentType: 'application/octet-stream',
          bytes: xlsx,
        }),
      ).toBe(undefined);
    });
  });
});
