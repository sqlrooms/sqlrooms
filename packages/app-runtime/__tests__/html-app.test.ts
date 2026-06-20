jest.mock('@sqlrooms/room-store', () => ({
  createSlice:
    (creator: unknown) =>
    (...args: unknown[]) =>
      typeof creator === 'function'
        ? (creator as (...innerArgs: unknown[]) => unknown)(...args)
        : creator,
  useBaseRoomStore: jest.fn(),
  useRoomStoreApi: jest.fn(),
}));

jest.mock('lucide-react', () => ({
  AppWindowIcon: () => null,
}));

import {
  createDefaultHtmlAppFiles,
  createHtmlAppSrcDoc,
  executeReadonlyQuery,
  resolveHtmlAppDependencyUrl,
  type HtmlAppState,
} from '../src/html-app';

describe('html-app helpers', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & {window?: unknown}).window = {
      setTimeout,
      clearTimeout,
    };
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & {window?: unknown}).window;
  });

  it('resolves structured dependencies to jsDelivr URLs', () => {
    expect(
      resolveHtmlAppDependencyUrl({
        package: 'd3',
        version: '7.9.0',
        entry: 'dist/d3.min.js',
        kind: 'script',
      }),
    ).toBe('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js');
  });

  it('injects the runtime prelude and dependency tags into srcdoc', () => {
    const app = createAppState({
      dependencies: [
        {
          package: 'd3',
          version: '7.9.0',
          entry: 'dist/d3.min.js',
          kind: 'script',
        },
      ],
    });

    const srcDoc = createHtmlAppSrcDoc(app);

    expect(srcDoc).toContain('Content-Security-Policy');
    expect(srcDoc).toContain(
      'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js',
    );
    expect(srcDoc.indexOf('sqlrooms.app-runtime.message')).toBeLessThan(
      srcDoc.indexOf('<body>'),
    );
  });

  it('inlines local script and stylesheet files from the source map', () => {
    const srcDoc = createHtmlAppSrcDoc(
      createAppState({
        files: {
          '/index.html': `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/src/app.css">
  </head>
  <body>
    <script type="module" src="/src/app.js"></script>
  </body>
</html>`,
          '/src/app.css': 'body { color: red; }',
          '/src/app.js': 'document.body.dataset.ready = "true";',
        },
      }),
    );

    expect(srcDoc).toContain('<style>body { color: red; }</style>');
    expect(srcDoc).toContain(
      '<script type="module" >document.body.dataset.ready = "true";</script>',
    );
    expect(srcDoc).not.toContain('src="/src/app.js"');
    expect(srcDoc).not.toContain('href="/src/app.css"');
  });

  it('rejects multiple SQL statements before execution', async () => {
    await expect(
      executeReadonlyQuery({
        request: {sql: 'select 1; select 2'},
        getState: createQueryState(),
        timeoutMs: 100,
        maxRows: 10,
      }),
    ).rejects.toThrow('Only a single read-only SELECT statement is allowed.');
  });

  it('rejects query params until the host can bind them end to end', async () => {
    const getState = createQueryState();

    await expect(
      executeReadonlyQuery({
        request: {sql: 'select ? as value', params: [1]},
        getState,
        timeoutMs: 100,
        maxRows: 10,
      }),
    ).rejects.toThrow('Query parameters are not supported');

    expect(getState().db.connectors.runQuery).not.toHaveBeenCalled();
  });

  it('returns bounded object rows and truncation metadata', async () => {
    const getState = createQueryState({
      rows: [{value: 1}, {value: 2}, {value: 3}],
    });
    const result = await executeReadonlyQuery({
      request: {sql: 'select value from numbers'},
      getState,
      timeoutMs: 100,
      maxRows: 2,
    });

    expect(result).toMatchObject({
      rows: [{value: 1}, {value: 2}],
      columns: [{name: 'value'}],
      rowCount: 2,
      truncated: true,
    });
    expect(getState().db.connectors.runQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryType: 'json',
        sql: expect.stringContaining('limit 3'),
      }),
    );
  });

  it('normalizes query rows for browser app consumers', async () => {
    const getState = createQueryState({
      rows: [
        {
          safeCount: 12n,
          unsafeInteger: BigInt(Number.MAX_SAFE_INTEGER) + 2n,
          nested: {createdAt: new Date('2026-06-20T12:00:00.000Z')},
        },
      ],
    });

    const result = await executeReadonlyQuery({
      request: {sql: 'select count(*) as safeCount'},
      getState,
      timeoutMs: 100,
      maxRows: 10,
    });

    expect(result.rows).toEqual([
      {
        safeCount: 12,
        unsafeInteger: '9007199254740993',
        nested: {createdAt: '2026-06-20T12:00:00.000Z'},
      },
    ]);
  });
});

function createAppState(patch: Partial<HtmlAppState> = {}): HtmlAppState {
  return {
    id: 'app-1',
    title: 'HTML App',
    files: createDefaultHtmlAppFiles('HTML App'),
    entryHtmlPath: '/index.html',
    requestedCapabilities: [],
    grantedCapabilities: [],
    dependencies: [],
    diagnostics: [],
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

function createQueryState({
  rows = [],
}: {
  rows?: Record<string, unknown>[];
} = {}) {
  const state = {
    htmlApps: {
      config: {appsById: {}},
      ensureApp: jest.fn(),
      updateApp: jest.fn(),
      updateAppFiles: jest.fn(),
      renameApp: jest.fn(),
      removeApp: jest.fn(),
      addDiagnostic: jest.fn(),
      setDiagnostics: jest.fn(),
      getApp: jest.fn(),
    },
    db: {
      sqlSelectToJson: jest.fn(async () => ({error: false})),
      connectors: {
        runQuery: jest.fn(async () => ({jsonData: rows})),
      },
    },
  };
  return () => state;
}
