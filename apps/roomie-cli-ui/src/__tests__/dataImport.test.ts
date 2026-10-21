import {beforeEach, describe, expect, it, jest} from '@jest/globals';
const invokeCommand =
  jest.fn<
    (...args: unknown[]) => Promise<{success: boolean; error?: string}>
  >();
const query = jest.fn(async (..._args: unknown[]) => ({numRows: 100}));
const fetcher = jest.fn<typeof fetch>();
jest.unstable_mockModule('../store', () => ({
  connector: {query},
  roomStore: {getState: () => ({commands: {invokeCommand}})},
}));
jest.unstable_mockModule('../auth', () => ({authorizedFetch: fetcher}));
const {
  dataFileQuery,
  inferDataFileFormat,
  suggestImportTableName,
  prepareDataImport,
  previewDataImport,
  commitDataImport,
} = await import('../dataImport');
beforeEach(() => {
  jest.clearAllMocks();
  invokeCommand.mockResolvedValue({success: true});
});

describe('import sources', () => {
  it.each([
    ['sales.csv', 'sales'],
    ['2026 sales.csv', '_2026_sales'],
    ['/tmp/My sales.parquet', 'My_sales'],
    ['C:\\data\\sales.jsonl', 'sales'],
    ['https://example.com/My%20sales.csv?signature=123#x', 'My_sales'],
    ['https://example.com/data.csv.gz?download=1', 'data'],
    ['', 'imported_data'],
  ])('suggests a filename-based name for %s', (source, expected) => {
    expect(suggestImportTableName(source, [])).toBe(expected);
  });
  it('avoids case-insensitive name collisions', () => {
    expect(suggestImportTableName('sales.csv', ['Sales', 'sales_1'])).toBe(
      'sales_2',
    );
  });
  it.each([
    ['https://example.com/file.parquet?download=1', 'parquet'],
    ['https://example.com/file.jsonl.gz', 'json'],
    ['data.csv.zst', 'csv'],
    ['file.exe', undefined],
  ])('infers the format for %s', (source, format) => {
    expect(inferDataFileFormat(source)).toBe(format);
  });
  it('escapes SQL quotes while preserving signed URL query parameters', () => {
    expect(
      dataFileQuery("https://example.com/it's.csv?token=a&b=c", 'csv', true),
    ).toBe(
      "SELECT * FROM read_csv_auto('https://example.com/it''s.csv?token=a&b=c')",
    );
  });
  it.each([
    'file:///etc/passwd',
    'ftp://example.com/data.csv',
    'https://user:pass@example.com/a.csv',
    'https://example.com/*.csv',
  ])('rejects unsupported remote source %s', (url) => {
    expect(() => dataFileQuery(url, 'csv', true)).toThrow();
  });
  it('previews a bounded sample without materializing a table', async () => {
    const source = await prepareDataImport({
      kind: 'url',
      url: 'https://example.com/file.csv',
      format: 'csv',
    });
    const controller = new AbortController();
    await previewDataImport(source, controller.signal);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM read_csv_auto('https://example.com/file.csv') LIMIT 100",
      {signal: controller.signal},
    );
    expect(invokeCommand).not.toHaveBeenCalled();
    await commitDataImport(source, 'sales');
    expect(invokeCommand).toHaveBeenCalledWith(
      'db.create-table-from-query',
      {query: source.query, tableName: 'sales'},
      {surface: 'palette'},
    );
  });
  it('uploads once, resolves the server path, and uses it for preview and import', async () => {
    fetcher
      .mockResolvedValueOnce(
        new Response(JSON.stringify({path: '/tmp/upload.csv'})),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({path: '/tmp/upload.csv', format: 'csv'})),
      );
    const source = await prepareDataImport({
      kind: 'file',
      file: new File(['a\n1'], 'test.csv'),
    });
    await previewDataImport(source);
    await commitDataImport(source, 'test');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(invokeCommand).toHaveBeenCalledWith(
      'db.import-file',
      {path: '/tmp/upload.csv', tableName: 'test'},
      {surface: 'palette'},
    );
  });
  it('surfaces import errors for correction without replacing existing tables', async () => {
    invokeCommand.mockResolvedValueOnce({
      success: false,
      error: 'Table already exists',
    });
    await expect(
      commitDataImport({path: '/tmp/a.csv', query: 'unused'}, 'existing'),
    ).rejects.toThrow('Table already exists');
    expect(invokeCommand.mock.calls[0]?.[1]).not.toHaveProperty('replace');
  });
  it('reports invalid local files before querying', async () => {
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({message: 'No such file'}), {status: 400}),
    );
    await expect(
      prepareDataImport({kind: 'path', path: '/missing.csv'}),
    ).rejects.toThrow('No such file');
    expect(query).not.toHaveBeenCalled();
  });
});
