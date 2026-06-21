jest.mock(
  '@sqlrooms/room-store',
  () => ({
    createSlice:
      (creator: unknown) =>
      (...args: unknown[]) =>
        typeof creator === 'function'
          ? (creator as (...innerArgs: unknown[]) => unknown)(...args)
          : creator,
    useBaseRoomStore: jest.fn(),
    useRoomStoreApi: jest.fn(),
  }),
  {virtual: true},
);

jest.mock('lucide-react', () => ({
  AppWindowIcon: () => null,
}));

import {
  commitHtmlAppRevisionState,
  createDefaultHtmlAppFiles,
  createHtmlAppSrcDoc,
  executeReadonlyQuery,
  redoHtmlAppRevisionState,
  restoreHtmlAppRevisionState,
  resolveHtmlAppDependencyUrl,
  undoHtmlAppRevisionState,
  HtmlAppState,
  type HtmlAppState as HtmlAppStateType,
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

  it('parses legacy app state with empty revision defaults', () => {
    const app = HtmlAppState.parse({
      id: 'app-1',
      title: 'Legacy App',
      files: createDefaultHtmlAppFiles('Legacy App'),
      entryHtmlPath: '/index.html',
      requestedCapabilities: [],
      grantedCapabilities: [],
      dependencies: [],
      diagnostics: [],
      createdAt: 1,
      updatedAt: 1,
    });

    expect(app.revisions).toEqual([]);
    expect(app.activeRevisionId).toBeUndefined();
    expect(app.redoRevisionIds).toEqual([]);
  });

  it('commits source snapshots and clears redo state for new revisions', () => {
    const first = commitHtmlAppRevisionState(
      createAppState({redoRevisionIds: ['rev-redo']}),
      {
        title: 'Revenue Explorer',
        files: {'/index.html': '<h1>Revenue</h1>'},
      },
      {
        revisionId: 'rev-1',
        name: 'Initial revenue explorer',
        source: 'assistant',
        sourcePrompt: 'Create a revenue explorer',
        createdAt: 10,
      },
    );

    expect(first.revision).toMatchObject({
      id: 'rev-1',
      name: 'Initial revenue explorer',
      source: 'assistant',
      sourcePrompt: 'Create a revenue explorer',
      title: 'Revenue Explorer',
    });
    expect(first.app.activeRevisionId).toBe('rev-1');
    expect(first.app.redoRevisionIds).toEqual([]);
    expect(first.app.revisions).toHaveLength(1);
  });

  it('restores by creating an auditable restore revision', () => {
    const first = commitHtmlAppRevisionState(
      createAppState(),
      {files: {'/index.html': '<h1>First</h1>'}},
      {revisionId: 'rev-1', name: 'First version', createdAt: 10},
    );
    const second = commitHtmlAppRevisionState(
      first.app,
      {files: {'/index.html': '<h1>Second</h1>'}},
      {revisionId: 'rev-2', name: 'Second version', createdAt: 20},
    );

    const restored = restoreHtmlAppRevisionState(second.app, 'rev-1', {
      revisionId: 'rev-restore',
      createdAt: 30,
    });

    expect(restored?.revision).toMatchObject({
      id: 'rev-restore',
      name: 'Restore First version',
      source: 'restore',
      parentRevisionId: 'rev-2',
      files: {'/index.html': '<h1>First</h1>'},
    });
    expect(restored?.app.activeRevisionId).toBe('rev-restore');
    expect(restored?.app.files).toEqual({'/index.html': '<h1>First</h1>'});
  });

  it('moves backward and forward through undo and redo revisions', () => {
    const first = commitHtmlAppRevisionState(
      createAppState(),
      {files: {'/index.html': '<h1>First</h1>'}},
      {revisionId: 'rev-1', name: 'First version', createdAt: 10},
    );
    const second = commitHtmlAppRevisionState(
      first.app,
      {files: {'/index.html': '<h1>Second</h1>'}},
      {revisionId: 'rev-2', name: 'Second version', createdAt: 20},
    );

    const undone = undoHtmlAppRevisionState(second.app);
    expect(undone?.revision.id).toBe('rev-1');
    expect(undone?.app.activeRevisionId).toBe('rev-1');
    expect(undone?.app.redoRevisionIds).toEqual(['rev-2']);
    expect(undone?.app.files).toEqual({'/index.html': '<h1>First</h1>'});

    const redone = redoHtmlAppRevisionState(undone!.app);
    expect(redone?.revision.id).toBe('rev-2');
    expect(redone?.app.activeRevisionId).toBe('rev-2');
    expect(redone?.app.redoRevisionIds).toEqual([]);
    expect(redone?.app.files).toEqual({'/index.html': '<h1>Second</h1>'});
  });

  it('snapshots capabilities when navigating revisions', () => {
    const restricted = commitHtmlAppRevisionState(
      createAppState({
        requestedCapabilities: ['query'],
        grantedCapabilities: ['query'],
      }),
      {
        files: {'/index.html': '<h1>Restricted</h1>'},
        requestedCapabilities: [],
        grantedCapabilities: [],
      },
      {revisionId: 'rev-1', name: 'Restricted version', createdAt: 10},
    );
    const queryEnabled = commitHtmlAppRevisionState(
      restricted.app,
      {
        files: {'/index.html': '<h1>Query</h1>'},
        requestedCapabilities: ['query'],
        grantedCapabilities: ['query'],
      },
      {revisionId: 'rev-2', name: 'Query version', createdAt: 20},
    );

    const undone = undoHtmlAppRevisionState(queryEnabled.app);
    expect(undone?.app.requestedCapabilities).toEqual([]);
    expect(undone?.app.grantedCapabilities).toEqual([]);

    const redone = redoHtmlAppRevisionState(undone!.app);
    expect(redone?.app.requestedCapabilities).toEqual(['query']);
    expect(redone?.app.grantedCapabilities).toEqual(['query']);

    const restored = restoreHtmlAppRevisionState(redone!.app, 'rev-1', {
      revisionId: 'rev-restore',
      createdAt: 30,
    });
    expect(restored?.app.requestedCapabilities).toEqual([]);
    expect(restored?.app.grantedCapabilities).toEqual([]);
  });

  it('snapshots intent when navigating revisions', () => {
    const sales = commitHtmlAppRevisionState(
      createAppState({intent: 'Build a sales chart'}),
      {
        intent: 'Build a sales chart',
        files: {'/index.html': '<h1>Sales</h1>'},
      },
      {revisionId: 'rev-sales', name: 'Sales chart', createdAt: 10},
    );
    const inventory = commitHtmlAppRevisionState(
      sales.app,
      {
        intent: 'Build an inventory chart',
        files: {'/index.html': '<h1>Inventory</h1>'},
      },
      {revisionId: 'rev-inventory', name: 'Inventory chart', createdAt: 20},
    );

    const undone = undoHtmlAppRevisionState(inventory.app);
    expect(undone?.app.intent).toBe('Build a sales chart');
    expect(undone?.app.files).toEqual({'/index.html': '<h1>Sales</h1>'});

    const redone = redoHtmlAppRevisionState(undone!.app);
    expect(redone?.app.intent).toBe('Build an inventory chart');
    expect(redone?.app.files).toEqual({'/index.html': '<h1>Inventory</h1>'});

    const restored = restoreHtmlAppRevisionState(redone!.app, 'rev-sales', {
      revisionId: 'rev-restore',
      createdAt: 30,
    });
    expect(restored?.app.intent).toBe('Build a sales chart');
    expect(restored?.revision.intent).toBe('Build a sales chart');
  });

  it('clears intent when restoring an intentless revision', () => {
    const legacy = commitHtmlAppRevisionState(
      createAppState(),
      {files: {'/index.html': '<h1>Legacy</h1>'}},
      {revisionId: 'rev-legacy', name: 'Legacy app', createdAt: 10},
    );
    const inventory = commitHtmlAppRevisionState(
      legacy.app,
      {
        intent: 'Build an inventory chart',
        files: {'/index.html': '<h1>Inventory</h1>'},
      },
      {revisionId: 'rev-inventory', name: 'Inventory chart', createdAt: 20},
    );

    const restored = restoreHtmlAppRevisionState(
      inventory.app,
      'rev-legacy',
      {
        revisionId: 'rev-restore',
        createdAt: 30,
      },
    );

    expect(restored?.app.intent).toBeUndefined();
    expect(restored?.revision.intent).toBeUndefined();
    expect(restored?.app.files).toEqual({'/index.html': '<h1>Legacy</h1>'});
  });

  it('prunes discarded redo revisions when committing from an undone revision', () => {
    const first = commitHtmlAppRevisionState(
      createAppState(),
      {files: {'/index.html': '<h1>First</h1>'}},
      {revisionId: 'rev-1', name: 'First version', createdAt: 10},
    );
    const second = commitHtmlAppRevisionState(
      first.app,
      {files: {'/index.html': '<h1>Second</h1>'}},
      {revisionId: 'rev-2', name: 'Second version', createdAt: 20},
    );
    const undone = undoHtmlAppRevisionState(second.app);

    const third = commitHtmlAppRevisionState(
      undone!.app,
      {files: {'/index.html': '<h1>Third</h1>'}},
      {revisionId: 'rev-3', name: 'Third version', createdAt: 30},
    );

    expect(third.app.revisions.map((revision) => revision.id)).toEqual([
      'rev-1',
      'rev-3',
    ]);
    expect(third.app.redoRevisionIds).toEqual([]);

    const nextUndo = undoHtmlAppRevisionState(third.app);
    expect(nextUndo?.revision.id).toBe('rev-1');
    expect(nextUndo?.app.files).toEqual({'/index.html': '<h1>First</h1>'});
  });
});

function createAppState(
  patch: Partial<HtmlAppStateType> = {},
): HtmlAppStateType {
  return {
    id: 'app-1',
    title: 'HTML App',
    files: createDefaultHtmlAppFiles('HTML App'),
    entryHtmlPath: '/index.html',
    requestedCapabilities: [],
    grantedCapabilities: [],
    dependencies: [],
    diagnostics: [],
    revisions: [],
    redoRevisionIds: [],
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
