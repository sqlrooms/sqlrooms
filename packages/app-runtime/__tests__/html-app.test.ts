jest.mock('@sqlrooms/room-store', () => ({
  createSlice:
    (creator: unknown) =>
    (...args: unknown[]) =>
      typeof creator === 'function'
        ? (creator as (...innerArgs: unknown[]) => unknown)(...args)
        : creator,
  useBaseRoomStore: jest.fn(),
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

  it('returns bounded object rows and truncation metadata', async () => {
    const result = await executeReadonlyQuery({
      request: {sql: 'select value from numbers'},
      getState: createQueryState({
        rows: [{value: 1}, {value: 2}, {value: 3}],
      }),
      timeoutMs: 100,
      maxRows: 2,
    });

    expect(result).toMatchObject({
      rows: [{value: 1}, {value: 2}],
      columns: [{name: 'value'}],
      rowCount: 2,
      truncated: true,
    });
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
  return () => ({
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
      runQuery: jest.fn(async () => ({jsonData: rows})),
    },
  });
}
