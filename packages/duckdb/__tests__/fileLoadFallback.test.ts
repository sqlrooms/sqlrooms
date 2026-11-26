import {
  getExtensionlessFileReader,
  getRegisteredFileSuffix,
} from '../src/connectors/fileLoadFallback';

const text = (s: string) => new TextEncoder().encode(s);

describe('getRegisteredFileSuffix', () => {
  it.each([
    ['data.csv', 'csv'],
    ['data.PARQUET', 'PARQUET'],
    ['path/to/data.csv.gz', 'csv.gz'],
    ['data.json.zst', 'json.zst'],
    ['archive.tar.gz', 'tar.gz'],
    ['data.gz', 'gz'],
    ['C:\\Users\\me\\data.xlsx', 'xlsx'],
    ['report #1.csv', 'csv'],
  ])('keeps the suffix of %s as %s', (name, suffix) => {
    expect(getRegisteredFileSuffix(name)).toBe(suffix);
  });

  it('drops the query string and fragment of a URL', () => {
    expect(
      getRegisteredFileSuffix(
        'https://bucket.s3.amazonaws.com/data.parquet?X-Amz-Signature=abc.def',
      ),
    ).toBe('parquet');
    expect(
      getRegisteredFileSuffix('https://example.com/data.csv.gz?x=1#frag'),
    ).toBe('csv.gz');
  });

  it.each([
    'https://api.example.com/export',
    'https://api.example.com/export?format=csv',
    'https://example.com',
    'https://example.com/',
    'export',
    '.env',
    'data.my-ext',
  ])('returns no suffix for %s', (name) => {
    expect(getRegisteredFileSuffix(name)).toBe('');
  });
});

describe('getExtensionlessFileReader', () => {
  it('uses the content type', () => {
    expect(getExtensionlessFileReader({contentType: 'text/csv'})).toBe(
      'read_csv',
    );
    expect(
      getExtensionlessFileReader({contentType: 'application/x-ndjson'}),
    ).toBe('read_json');
    expect(
      getExtensionlessFileReader({
        contentType: 'application/vnd.apache.parquet',
      }),
    ).toBe('read_parquet');
  });

  it('uses magic bytes when the content type is generic', () => {
    expect(
      getExtensionlessFileReader({
        contentType: 'binary/octet-stream',
        bytes: text('PAR1'),
      }),
    ).toBe('read_parquet');
    expect(
      getExtensionlessFileReader({contentType: '', bytes: text(' [{"a":1}]')}),
    ).toBe('read_json');
  });

  it('falls back to read_csv when nothing identifies the format', () => {
    expect(
      getExtensionlessFileReader({
        contentType: 'text/plain',
        bytes: text('a,b\n1,2\n'),
      }),
    ).toBe('read_csv');
    expect(getExtensionlessFileReader({})).toBe('read_csv');
  });

  it('keeps the existing path for Arrow IPC', () => {
    expect(getExtensionlessFileReader({bytes: text('ARROW1\0\0')})).toBe(
      undefined,
    );
  });
});
