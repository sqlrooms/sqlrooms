import {afterEach, describe, expect, test} from '@jest/globals';
import {
  createDefaultLoadTableSchemasFilter,
  defaultLoadSchemaCatalogFilter,
  type DbSchemaNode,
  type QualifiedTableName,
  type SchemaCatalogFilterEntry,
} from '@sqlrooms/duckdb';
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {createStore} from 'zustand';
import {
  createRoomShellSlice,
  type RoomShellSliceState,
} from '../src/RoomShellSlice';

type CreateDbProps = Parameters<
  typeof createRoomShellSlice
>[0]['createDbProps'];

const stores: ReturnType<typeof createTestStore>[] = [];

function createTestStore(createDbProps?: CreateDbProps) {
  const store = createStore<RoomShellSliceState>()((...args) =>
    createRoomShellSlice({
      connector: createNodeDuckDbConnector({dbPath: ':memory:'}),
      config: {title: 'Test', dataSources: []},
      createDbProps,
    })(...args),
  );
  stores.push(store);
  return store;
}

/** Creates one ordinary, one app-internal and one SQLRooms-internal table. */
async function createTablesAndRefresh(
  store: ReturnType<typeof createTestStore>,
) {
  const {db} = store.getState();
  await db.initialize();
  const connector = await db.getConnector();
  await connector.query(`
    CREATE TABLE visible AS SELECT 1 AS id;
    CREATE TABLE staging_replacement AS SELECT 1 AS id;
    CREATE TABLE __sqlrooms_internal AS SELECT 1 AS id;
  `);
  await db.refreshTableSchemas();
}

function tableNames(store: ReturnType<typeof createTestStore>) {
  return store
    .getState()
    .db.tables.map((t) => t.table.table)
    .sort();
}

function schemaTreeTableNames(store: ReturnType<typeof createTestStore>) {
  const names: string[] = [];
  const visit = (nodes: DbSchemaNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.object.type === 'table') names.push(node.object.name);
      visit(node.children);
    }
  };
  visit(store.getState().db.schemaTrees);
  return names.sort();
}

/** App rule: hide staging tables, on top of the default hiding. */
const isStagingTable = (table: QualifiedTableName) =>
  table.table.startsWith('staging_');

afterEach(async () => {
  for (const store of stores.splice(0)) {
    await store.getState().db.destroy();
  }
});

describe('createRoomShellSlice schema filters', () => {
  test('without createDbProps, only the default hiding applies', async () => {
    const store = createTestStore();
    await createTablesAndRefresh(store);

    expect(tableNames(store)).toEqual(['staging_replacement', 'visible']);
    expect(schemaTreeTableNames(store)).toEqual([
      'staging_replacement',
      'visible',
    ]);
  });

  test('app filters passed through createDbProps.duckDb hide tables from db.tables and schema trees', async () => {
    const defaultTableFilter = createDefaultLoadTableSchemasFilter();
    const store = createTestStore({
      duckDb: {
        loadTableSchemasFilter: (table) =>
          defaultTableFilter(table) && !isStagingTable(table),
        loadSchemaCatalogFilter: (entry: SchemaCatalogFilterEntry) =>
          defaultLoadSchemaCatalogFilter(entry) &&
          !(entry.type === 'table' && isStagingTable(entry.table)),
      },
    });
    await createTablesAndRefresh(store);

    expect(tableNames(store)).toEqual(['visible']);
    expect(schemaTreeTableNames(store)).toEqual(['visible']);

    // Hidden tables stay queryable.
    const connector = await store.getState().db.getConnector();
    const result = await connector.query(
      'SELECT count(*) AS n FROM staging_replacement',
    );
    expect(result.numRows).toBe(1);
  });

  test('a table filter alone also hides catalog table entries', async () => {
    const defaultTableFilter = createDefaultLoadTableSchemasFilter();
    const store = createTestStore({
      duckDb: {
        loadTableSchemasFilter: (table) =>
          defaultTableFilter(table) && !isStagingTable(table),
      },
    });
    await createTablesAndRefresh(store);

    expect(tableNames(store)).toEqual(['visible']);
    expect(schemaTreeTableNames(store)).toEqual(['visible']);
  });

  test('a filter that does not compose with the default replaces it', async () => {
    // Documents why apps should start from the default filters: a filter
    // that ignores them stops hiding `__sqlrooms*` names.
    const store = createTestStore({
      duckDb: {loadTableSchemasFilter: (table) => !isStagingTable(table)},
    });
    await createTablesAndRefresh(store);

    expect(tableNames(store)).toEqual(['__sqlrooms_internal', 'visible']);
  });
});
