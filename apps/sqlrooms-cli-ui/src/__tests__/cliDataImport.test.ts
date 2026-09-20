import {afterEach, beforeEach, expect, jest, test} from '@jest/globals';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore, type StateCreator, type StoreApi} from 'zustand/vanilla';
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {
  createCliDomainSlice,
  type CliDomainState,
} from '../createCliDomainSlice';
import {createCliHeadlessArtifactTypes} from '../createCliDocumentArtifactDefinition';
import {resolveCliCapabilityProfile} from '../profiles';
import {createCliCapabilityRuntime} from '../createCliCapabilityRuntime';
import {needsCliReadApproval, inspectCliSelect} from '../cliSqlPolicy';

let directory: string;
let connector: ReturnType<typeof createNodeDuckDbConnector>;
let store: StoreApi<CliDomainState>;
let runtime: ReturnType<typeof createCliCapabilityRuntime>;
let decision: 'allow' | 'deny' = 'allow';
const approve = jest.fn(async (_operation: unknown) => decision);
const resolver = jest.fn(
  async ({
    path,
    format,
  }: {
    path: string;
    format?: 'csv' | 'parquet' | 'json';
  }) => ({
    path,
    format: format ?? ('csv' as const),
  }),
);

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'sqlrooms-import-'));
  await writeFile(join(directory, "car's.csv"), 'name,mpg\nA,24\nB,32\n');
  connector = createNodeDuckDbConnector({
    dbPath: join(directory, 'workspace.duckdb'),
  });
  const profile = resolveCliCapabilityProfile({
    profileName: 'document-charts-maps',
  });
  store = createStore<CliDomainState>()(
    createCliDomainSlice({
      profile,
      artifactTypes: createCliHeadlessArtifactTypes(profile),
      shell: {connector, config: {title: 'Import test', dataSources: []}},
      resolveLocalFile: resolver,
    }) as unknown as StateCreator<CliDomainState>,
  );
  await store.getState().room.initialize();
  runtime = createCliCapabilityRuntime({
    store,
    policy: {authorize: () => ({allowed: true})},
    approveOperation: approve,
  });
  decision = 'allow';
  approve.mockClear();
  resolver.mockClear();
});
afterEach(async () => {
  runtime?.dispose();
  await runtime?.drain();
  await store?.getState().room.destroy();
  await connector?.destroy();
  await rm(directory, {recursive: true, force: true});
});
const call = (commandId: string, input: unknown) =>
  runtime.callTool(
    'execute_command',
    {commandId, input},
    {surface: 'mcp-http'},
  );
const importCars = () =>
  call('db.import-file', {
    path: join(directory, "car's.csv"),
    tableName: 'cars',
  });

test('removes URL sources from the CLI registry and every MCP lookup', async () => {
  expect(
    store.getState().commands.getCommand('room.add-url-data-source'),
  ).toBeUndefined();
  expect(
    await runtime.callTool(
      'get_command',
      {commandId: 'room.add-url-data-source'},
      {surface: 'mcp-http'},
    ),
  ).toMatchObject({ok: false, code: 'command_not_found'});
  expect(
    await call('room.add-url-data-source', {
      url: 'file:///tmp/file.csv',
      tableName: 'cars',
    }),
  ).toMatchObject({ok: false, code: 'command_not_found'});
});

test('imports with one write approval, reports completed rows/schema, and persists in DuckDB', async () => {
  expect(await importCars()).toMatchObject({
    ok: true,
    data: {
      data: {
        rowCount: 2,
        columns: expect.arrayContaining([
          expect.objectContaining({name: 'mpg'}),
        ]),
      },
    },
  });
  expect(approve).toHaveBeenCalledTimes(1);
  expect(approve.mock.calls[0]?.[0]).toMatchObject({
    kind: 'write',
    commandId: 'db.import-file',
  });
  expect(
    await runtime.callTool(
      'query',
      {sql: 'SELECT count(*) AS count, avg(mpg) AS mpg FROM cars'},
      {surface: 'mcp-http'},
    ),
  ).toMatchObject({ok: true, data: {rows: [{count: 2, mpg: 28}]}});
  expect(approve).toHaveBeenCalledTimes(1);
  runtime.dispose();
  await runtime.drain();
  await store.getState().room.destroy();
  await connector.destroy();
  connector = createNodeDuckDbConnector({
    dbPath: join(directory, 'workspace.duckdb'),
  });
  await connector.initialize();
  expect((await connector.query('SELECT * FROM cars')).numRows).toBe(2);
});

test('denial never resolves the file or writes a table', async () => {
  decision = 'deny';
  expect(await importCars()).toMatchObject({
    ok: false,
    code: 'permission_denied',
  });
  expect(resolver).not.toHaveBeenCalled();
  expect(await store.getState().db.checkTableExists('cars')).toBe(false);
});

test('default import never replaces existing data; explicit replacement still needs approval', async () => {
  await importCars();
  await writeFile(join(directory, "car's.csv"), 'name,mpg\nC,99\n');
  expect(await importCars()).toMatchObject({ok: false});
  expect((await connector.query('SELECT * FROM cars')).numRows).toBe(2);
  decision = 'deny';
  expect(
    await call('db.import-file', {
      path: join(directory, "car's.csv"),
      tableName: 'cars',
      replace: true,
    }),
  ).toMatchObject({ok: false});
  expect((await connector.query('SELECT * FROM cars')).numRows).toBe(2);
  decision = 'allow';
  expect(
    await call('db.import-file', {
      path: join(directory, "car's.csv"),
      tableName: 'cars',
      replace: true,
    }),
  ).toMatchObject({ok: true, data: {data: {rowCount: 1}}});
});

test('table creation is discoverable, guarded, single-statement, and non-replacing by default', async () => {
  expect(
    await call('db.create-table-from-query', {
      tableName: 'derived',
      query: 'SELECT 7 AS value',
    }),
  ).toMatchObject({ok: true});
  expect(
    await call('db.create-table-from-query', {
      tableName: 'derived',
      query: 'SELECT 8 AS value',
    }),
  ).toMatchObject({ok: false});
  expect(
    await call('db.create-table-from-query', {
      tableName: 'bad',
      query: 'DROP TABLE derived; SELECT 1',
    }),
  ).toMatchObject({ok: false});
  expect(
    await call('db.create-table-from-query', {
      tableName: 'bad',
      query: 'SELECT 1',
      allowMultipleStatements: true,
    }),
  ).toMatchObject({ok: false});
  expect(
    await call('db.create-table-from-query', {
      tableName: '__sqlrooms.ui_state',
      query: 'SELECT 1',
    }),
  ).toMatchObject({ok: false});
  expect(await store.getState().db.checkTableExists('derived')).toBe(true);
});

test('direct file reads and views need separate approval; a query never runs on denial', async () => {
  decision = 'deny';
  expect(
    await runtime.callTool(
      'query',
      {sql: "SELECT * FROM read_csv('/does-not-exist.csv')"},
      {surface: 'mcp-http'},
    ),
  ).toMatchObject({ok: false, code: 'permission_denied'});
  expect(approve).toHaveBeenCalledTimes(1);
  await connector.query('CREATE VIEW source_view AS SELECT 42 AS value');
  const parsed = await inspectCliSelect(
    store.getState().db,
    'SELECT * FROM source_view',
    '__sqlrooms',
  );
  expect(await needsCliReadApproval(store.getState().db, parsed)).toBe(true);
});

test('macro names cannot disguise external access as an ordinary function', async () => {
  await connector.query(
    'CREATE MACRO lower(x) AS (SELECT content FROM read_text(x))',
  );
  const parsed = await inspectCliSelect(
    store.getState().db,
    "SELECT lower('/does-not-exist')",
    '__sqlrooms',
  );
  expect(await needsCliReadApproval(store.getState().db, parsed)).toBe(true);
});

test('qualified names refer to the actual schema and quoted internal destinations remain protected', async () => {
  await connector.query('CREATE SCHEMA analytics');
  expect(
    await call('db.import-file', {
      path: join(directory, "car's.csv"),
      tableName: 'analytics.cars',
    }),
  ).toMatchObject({
    ok: true,
    data: {data: {rowCount: 2, columns: expect.any(Array)}},
  });
  expect((await connector.query('SELECT * FROM analytics.cars')).numRows).toBe(
    2,
  );
  await connector.query(
    'CREATE SCHEMA "__sqlrooms"; CREATE TABLE "__sqlrooms".secret(value INT)',
  );
  for (const commandId of [
    'db.drop-table',
    'db.create-table-from-query',
    'db.import-file',
  ]) {
    expect(
      await call(commandId, {
        tableName: '"__sqlrooms"."secret"',
        query: 'SELECT 1',
        path: join(directory, "car's.csv"),
      }),
    ).toMatchObject({ok: false});
  }
  expect(
    (await connector.query('SELECT * FROM "__sqlrooms".secret')).numRows,
  ).toBe(0);
});

test('imports reject glob filenames instead of reading a different neighboring file', async () => {
  await writeFile(join(directory, 'sales[1].csv'), 'value\n123\n');
  await writeFile(join(directory, 'sales1.csv'), 'value\n456\n');
  expect(
    await call('db.import-file', {
      path: join(directory, 'sales[1].csv'),
      tableName: 'sales',
    }),
  ).toMatchObject({ok: false});
  expect(await store.getState().db.checkTableExists('sales')).toBe(false);
});

test('unverified window functions and tables in attached databases need approval', async () => {
  await importCars();
  await connector.query(
    "ATTACH ':memory:' AS other; CREATE TABLE other.remote AS SELECT 1 AS value",
  );
  for (const sql of [
    'SELECT corr(mpg,mpg) OVER () FROM cars',
    'SELECT * FROM other.remote',
  ]) {
    const parsed = await inspectCliSelect(
      store.getState().db,
      sql,
      '__sqlrooms',
    );
    expect(await needsCliReadApproval(store.getState().db, parsed)).toBe(true);
  }
});

test('temporary tables and UI-hidden schemas return the created schema', async () => {
  await connector.query('CREATE SCHEMA mosaic');
  for (const input of [
    {tableName: 'scratch', temp: true},
    {tableName: 'mosaic.hidden'},
  ]) {
    expect(
      await call('db.create-table-from-query', {
        ...input,
        query: 'SELECT 9 AS value',
      }),
    ).toMatchObject({
      ok: true,
      data: {
        data: {
          rowCount: 1,
          columns: expect.arrayContaining([
            expect.objectContaining({name: 'value'}),
          ]),
        },
      },
    });
  }
});

test('unqualified references cannot bypass internal-schema protection', async () => {
  await connector.query(
    'CREATE SCHEMA __sqlrooms; CREATE TABLE __sqlrooms.secret AS SELECT 123 AS value',
  );
  await connector.query("SET schema='__sqlrooms'");
  expect(
    await runtime.callTool(
      'query',
      {sql: 'SELECT * FROM secret'},
      {surface: 'mcp-http'},
    ),
  ).toMatchObject({ok: false, code: 'query_internal_namespace'});
  expect(approve).not.toHaveBeenCalled();
  expect(
    await runtime.callTool(
      'query',
      {sql: 'SELECT corr(value,value) OVER () FROM secret'},
      {surface: 'mcp-http'},
    ),
  ).toMatchObject({ok: false, code: 'query_internal_namespace'});
  expect(
    await call('db.create-table-from-query', {
      tableName: 'main.copy',
      query: 'SELECT * FROM secret',
    }),
  ).toMatchObject({ok: false});
  expect(
    (
      await connector.query(
        "SELECT * FROM duckdb_tables() WHERE table_name='copy'",
      )
    ).numRows,
  ).toBe(0);
});

test.each(['json', 'parquet'] as const)(
  'imports a %s file into the database',
  async (format) => {
    const path = join(directory, `source.${format}`);
    if (format === 'json') await writeFile(path, '[{"value":7},{"value":8}]');
    else
      await connector.query(
        `COPY (SELECT 7 AS value UNION ALL SELECT 8) TO '${path}' (FORMAT PARQUET)`,
      );
    expect(
      await call('db.import-file', {path, format, tableName: 'imported'}),
    ).toMatchObject({ok: true, data: {data: {rowCount: 2}}});
  },
);

test('cancellation at approval prevents a pending write from running', async () => {
  const controller = new AbortController();
  approve.mockImplementationOnce(async () => {
    controller.abort();
    return 'allow';
  });
  expect(
    await runtime.callTool(
      'execute_command',
      {
        commandId: 'db.import-file',
        input: {path: join(directory, "car's.csv"), tableName: 'cars'},
      },
      {surface: 'mcp-http', signal: controller.signal},
    ),
  ).toMatchObject({ok: false, code: 'cancelled'});
  expect(resolver).not.toHaveBeenCalled();
});
