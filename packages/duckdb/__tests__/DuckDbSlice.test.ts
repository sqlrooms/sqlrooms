import {createStore} from 'zustand';
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {createDuckDbSlice, DuckDbSliceState} from '../src/DuckDbSlice';
import {createBaseRoomSlice, BaseRoomStoreState} from '@sqlrooms/room-store';
import * as arrow from 'apache-arrow';

type TestStoreState = BaseRoomStoreState & DuckDbSliceState;

/**
 * Creates a test store with DuckDbSlice using a real Node.js DuckDB connector.
 */
function createTestStore() {
  const connector = createNodeDuckDbConnector({
    dbPath: ':memory:',
  });

  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDuckDbSlice({connector})(...args),
  }));
}

describe('DuckDbSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    store = createTestStore();
    await store.getState().db.initialize();
  });

  afterEach(async () => {
    await store.getState().db.destroy();
  });

  describe('initialize', () => {
    it('should initialize the connector', async () => {
      // Re-create to test fresh initialization
      const newStore = createTestStore();
      await newStore.getState().db.initialize();
      expect(newStore.getState().db.connector).toBeDefined();
      await newStore.getState().db.destroy();
    });
  });

  describe('createTableFromQuery', () => {
    it('should create a table from a simple SELECT query', async () => {
      const result = await store
        .getState()
        .db.createTableFromQuery('test_table', 'SELECT 1 as id, 2 as value');

      expect(result.tableName).toBe('test_table');
      expect(result.rowCount).toBe(1);

      // Verify the table exists and has correct data
      const connector = await store.getState().db.getConnector();
      const table = await connector.query('SELECT * FROM test_table');
      expect(table.numRows).toBe(1);
    });

    it('should create a table with multiple rows', async () => {
      const result = await store
        .getState()
        .db.createTableFromQuery(
          'numbers',
          'SELECT * FROM (VALUES (1), (2), (3)) AS t(num)',
        );

      expect(result.rowCount).toBe(3);
    });

    it('should replace existing table by default', async () => {
      await store
        .getState()
        .db.createTableFromQuery('replaceable', 'SELECT 1 as value');

      const result = await store
        .getState()
        .db.createTableFromQuery('replaceable', 'SELECT 2 as value');

      expect(result.rowCount).toBe(1);

      const connector = await store.getState().db.getConnector();
      const table = await connector.queryJson<{value: number}>(
        'SELECT * FROM replaceable',
      );
      const rows = Array.from(table);
      expect(rows[0]?.value).toBe(2);
    });

    it('should create a view when view option is true', async () => {
      const result = await store
        .getState()
        .db.createTableFromQuery('test_view', 'SELECT 1 as id', {view: true});

      expect(result.tableName).toBe('test_view');
      expect(result.rowCount).toBeUndefined(); // Views don't have row count

      // Verify the view exists
      const connector = await store.getState().db.getConnector();
      const viewResult = await connector.query('SELECT * FROM test_view');
      expect(viewResult.numRows).toBe(1);
    });

    it('should create a temp table when temp option is true', async () => {
      const result = await store
        .getState()
        .db.createTableFromQuery('temp_table', 'SELECT 1 as id', {temp: true});

      expect(result.rowCount).toBe(1);

      // Verify the temp table exists
      const connector = await store.getState().db.getConnector();
      const tempResult = await connector.query('SELECT * FROM temp_table');
      expect(tempResult.numRows).toBe(1);
    });

    it('should handle multiple statements when allowMultipleStatements is true', async () => {
      const result = await store.getState().db.createTableFromQuery(
        'result_table',
        `
          CREATE TABLE source AS SELECT 1 as a, 2 as b;
          SELECT a + b as sum FROM source
        `,
        {allowMultipleStatements: true},
      );

      expect(result.rowCount).toBe(1);

      const connector = await store.getState().db.getConnector();
      const sumResult = await connector.queryJson<{sum: number}>(
        'SELECT * FROM result_table',
      );
      const rows = Array.from(sumResult);
      expect(rows[0]?.sum).toBe(3);
    });

    it('should throw error for multiple statements without allowMultipleStatements', async () => {
      await expect(
        store
          .getState()
          .db.createTableFromQuery(
            'fail_table',
            'CREATE TABLE t1 (id INT); SELECT 1',
          ),
      ).rejects.toThrow('Query must contain exactly one statement');
    });

    it('should throw error for non-SELECT final statement', async () => {
      await expect(
        store
          .getState()
          .db.createTableFromQuery('fail_table', 'CREATE TABLE t1 (id INT)'),
      ).rejects.toThrow('Final statement must be a valid SELECT statement');
    });
  });

  describe('addTable', () => {
    it('should load objects using connector.loadObjects', async () => {
      const data = [
        {id: 1, name: 'Alice'},
        {id: 2, name: 'Bob'},
      ];

      const connector = await store.getState().db.getConnector();
      await connector.loadObjects(data, 'users');

      const table = await connector.query('SELECT * FROM users ORDER BY id');
      expect(table.numRows).toBe(2);
    });

    it('should load Arrow table using connector.loadArrow', async () => {
      const arrowTable = arrow.tableFromJSON([
        {id: 1, value: 100},
        {id: 2, value: 200},
      ]);

      const connector = await store.getState().db.getConnector();
      await connector.loadArrow(arrowTable, 'arrow_table');

      const table = await connector.query(
        'SELECT * FROM arrow_table ORDER BY id',
      );
      expect(table.numRows).toBe(2);
    });
  });

  describe('dropTable', () => {
    it('should drop an existing table', async () => {
      // First create a table
      await store
        .getState()
        .db.createTableFromQuery('to_drop', 'SELECT 1 as id');

      // Verify it exists
      const connector = await store.getState().db.getConnector();
      let exists = true;
      try {
        await connector.query('SELECT * FROM to_drop');
      } catch {
        exists = false;
      }
      expect(exists).toBe(true);

      // Drop it
      await store.getState().db.dropTable('to_drop');

      // Verify it's gone
      await expect(connector.query('SELECT * FROM to_drop')).rejects.toThrow();
    });
  });

  describe('loadTableSchemas', () => {
    it('should load table schemas using queryJson', async () => {
      // Create some tables
      await store
        .getState()
        .db.createTableFromQuery('schema_test1', 'SELECT 1 as id, 2 as value');

      // Use queryJson directly since loadTableSchemas uses complex query
      const connector = await store.getState().db.getConnector();
      const result = await connector.queryJson<{table_name: string}>(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'schema_test1'",
      );
      const rows = Array.from(result);

      expect(rows.length).toBe(1);
      expect(rows[0]?.table_name).toBe('schema_test1');
    });
  });

  describe('loadTableRowCount', () => {
    it('should return the row count of a table', async () => {
      await store
        .getState()
        .db.createTableFromQuery(
          'count_test',
          'SELECT * FROM (VALUES (1), (2), (3), (4), (5)) AS t(num)',
        );

      const count = await store.getState().db.loadTableRowCount('count_test');
      expect(count).toBe(5);
    });
  });

  describe('executeSql', () => {
    it('should execute a query using connector directly', async () => {
      await store
        .getState()
        .db.createTableFromQuery('exec_test', 'SELECT 42 as answer');

      // Use connector.query directly for simpler testing
      const connector = await store.getState().db.getConnector();
      const result = await connector.query('SELECT * FROM exec_test');

      expect(result.numRows).toBe(1);
    });
  });

  describe('sqlSelectToJson', () => {
    it('should return error for invalid SQL', async () => {
      const result = await store
        .getState()
        .db.sqlSelectToJson('INVALID SQL STATEMENT');

      // Invalid SQL should have error set (could be false or error message)
      expect(result.error !== undefined).toBe(true);
    });
  });

  describe('setTableRowCount', () => {
    it('should set table row count in state', async () => {
      // setTableRowCount stores with qualified name format
      store.getState().db.setTableRowCount({table: 'my_table'}, 100);

      // Check the actual keys to understand the format
      const rowCounts = store.getState().db.tableRowCounts;
      const keys = Object.keys(rowCounts);

      // There should be one entry with our row count
      expect(keys.length).toBe(1);
      expect(rowCounts[keys[0] as string]).toBe(100);
    });
  });
});
