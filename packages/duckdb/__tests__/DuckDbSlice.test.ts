import {createStore} from 'zustand';
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {
  createDefaultLoadTableSchemasFilter,
  createDuckDbSlice,
  DuckDbSliceState,
} from '../src/DuckDbSlice';
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

/**
 * Test-only composed filter: default sqlrooms rules plus arbitrary extra schema/db/table
 * exclusions (neutral names — product apps supply their own filters at integration time).
 */
function createTestComposedLoadTableSchemasFilter() {
  const base = createDefaultLoadTableSchemasFilter();
  return (table) => {
    if (!base(table)) {
      return false;
    }
    const schema = table.schema || '';
    if (
      schema === 'excluded_schema_alpha' ||
      schema === 'excluded_schema_beta' ||
      schema === 'temp'
    ) {
      return false;
    }
    if (table.database === 'excluded_attach_db') {
      return false;
    }
    if (table.table === 'excluded_table_name') {
      return false;
    }
    return true;
  };
}

function createTestStoreWithCustomComposedFilter() {
  const connector = createNodeDuckDbConnector({
    dbPath: ':memory:',
  });

  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDuckDbSlice({
      connector,
      loadTableSchemasFilter: createTestComposedLoadTableSchemasFilter(),
    })(...args),
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

      // Verify the view exists in duckdb_views()
      const connector = await store.getState().db.getConnector();
      const viewCheck = await connector.queryJson<{view_name: string}>(
        "SELECT view_name FROM duckdb_views() WHERE view_name = 'test_view'",
      );
      const views = Array.from(viewCheck);
      expect(views.length).toBe(1);
      expect(views[0]?.view_name).toBe('test_view');

      // Also verify we can query from it
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

    it('should reject dropping a view', async () => {
      await store
        .getState()
        .db.createTableFromQuery('view_via_drop_table', 'SELECT 1 as id', {
          view: true,
        });

      await expect(
        store.getState().db.dropTable('view_via_drop_table'),
      ).rejects.toThrow('Use dropRelation() to remove views.');
    });
  });

  describe('dropRelation', () => {
    it('should drop an existing view', async () => {
      await store
        .getState()
        .db.createTableFromQuery('view_to_drop', 'SELECT 1 as id', {
          view: true,
        });

      const connector = await store.getState().db.getConnector();
      await expect(
        connector.query('SELECT * FROM view_to_drop'),
      ).resolves.toBeTruthy();

      await store.getState().db.dropRelation('view_to_drop');

      await expect(
        connector.query('SELECT * FROM view_to_drop'),
      ).rejects.toThrow();
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

  describe('loadTableSchemas filter bypass', () => {
    it('should filter out internal tables by default', async () => {
      // Create an internal table
      await store
        .getState()
        .db.createTableFromQuery(
          '__sqlrooms_internal',
          'SELECT 1 as id, 2 as value',
        );

      // Create a normal table
      await store
        .getState()
        .db.createTableFromQuery('normal_table', 'SELECT 1 as id, 2 as value');

      // Load all tables without bypass - should not include internal table
      const tables = await store.getState().db.loadTableSchemas();

      // Should not include the internal table
      expect(tables.find((t) => t.table.table === '__sqlrooms_internal')).toBe(
        undefined,
      );

      // Should include the normal table
      expect(
        tables.find((t) => t.table.table === 'normal_table'),
      ).toBeDefined();
    });

    it('should allow addTable with internal table names', async () => {
      const data = [
        {id: 1, name: 'Alice'},
        {id: 2, name: 'Bob'},
      ];

      // This should not throw "Failed to add table"
      const table = await store
        .getState()
        .db.addTable('__sqlrooms_users', data);

      expect(table).toBeDefined();
      expect(table.table.table).toBe('__sqlrooms_users');

      // Verify it exists in the database
      const connector = await store.getState().db.getConnector();
      const result = await connector.query(
        'SELECT * FROM __sqlrooms_users ORDER BY id',
      );
      expect(result.numRows).toBe(2);
    });

    it('should allow checkTableExists with internal table names', async () => {
      // Create an internal table
      await store
        .getState()
        .db.createTableFromQuery(
          '__sqlrooms_check',
          'SELECT 1 as id, 2 as value',
        );

      // checkTableExists should find it
      const exists = await store
        .getState()
        .db.checkTableExists('__sqlrooms_check');

      expect(exists).toBe(true);
    });

    it('should allow dropTable with internal table names', async () => {
      // Create an internal table
      await store
        .getState()
        .db.createTableFromQuery(
          '__sqlrooms_drop_test',
          'SELECT 1 as id, 2 as value',
        );

      // Verify it exists
      const connector = await store.getState().db.getConnector();
      const beforeDrop = await connector.query(
        'SELECT * FROM __sqlrooms_drop_test',
      );
      expect(beforeDrop.numRows).toBe(1);

      // Drop it - should not throw
      await store.getState().db.dropTable('__sqlrooms_drop_test');

      // Verify it's gone
      await expect(
        connector.query('SELECT * FROM __sqlrooms_drop_test'),
      ).rejects.toThrow();
    });

    it('should allow dropRelation with internal view names', async () => {
      // Create an internal view
      await store
        .getState()
        .db.createTableFromQuery('__sqlrooms_view', 'SELECT 1 as id', {
          view: true,
        });

      // Verify it exists
      const connector = await store.getState().db.getConnector();
      const beforeDrop = await connector.query('SELECT * FROM __sqlrooms_view');
      expect(beforeDrop.numRows).toBe(1);

      // Drop it - should not throw
      await store.getState().db.dropRelation('__sqlrooms_view');

      // Verify it's gone
      await expect(
        connector.query('SELECT * FROM __sqlrooms_view'),
      ).rejects.toThrow();
    });

    it('should filter internal schemas by default', async () => {
      const connector = await store.getState().db.getConnector();

      // Create an internal schema and table
      await connector.query('CREATE SCHEMA __sqlrooms_schema');
      await connector.query(
        'CREATE TABLE __sqlrooms_schema.test_table (id INT)',
      );

      // Create a normal schema and table
      await connector.query('CREATE SCHEMA normal_schema');
      await connector.query('CREATE TABLE normal_schema.test_table (id INT)');

      // Load all tables without bypass
      const tables = await store.getState().db.loadTableSchemas();

      // Should not include tables from internal schema
      expect(
        tables.find(
          (t) =>
            t.table.schema === '__sqlrooms_schema' &&
            t.table.table === 'test_table',
        ),
      ).toBe(undefined);

      // Should include tables from normal schema
      expect(
        tables.find(
          (t) =>
            t.table.schema === 'normal_schema' &&
            t.table.table === 'test_table',
        ),
      ).toBeDefined();
    });

    it('should allow exact lookup of tables in internal schemas', async () => {
      const connector = await store.getState().db.getConnector();

      // Create an internal schema and table
      await connector.query('CREATE SCHEMA __sqlrooms_test_schema');
      await connector.query(
        'CREATE TABLE __sqlrooms_test_schema.my_table (id INT)',
      );

      // checkTableExists should find it with qualified name
      const exists = await store.getState().db.checkTableExists({
        schema: '__sqlrooms_test_schema',
        table: 'my_table',
      });

      expect(exists).toBe(true);
    });
  });

  describe('empty schemas and hidden schemas visibility', () => {
    it('should include empty schemas in schemaTrees', async () => {
      const connector = await store.getState().db.getConnector();

      // Create an empty schema
      await connector.query('CREATE SCHEMA empty_schema');

      // Refresh schemas
      await store.getState().db.refreshTableSchemas();

      // Get the schema trees
      const schemaTrees = store.getState().db.schemaTrees;

      // Find the empty schema in the tree
      const hasEmptySchema = schemaTrees.some((dbNode) =>
        dbNode.children?.some(
          (schemaNode) => schemaNode.object.name === 'empty_schema',
        ),
      );

      expect(hasEmptySchema).toBe(true);
    });

    it('should hide __sqlrooms_* schemas from schemaTrees', async () => {
      const connector = await store.getState().db.getConnector();

      // Create an internal schema (should be hidden)
      await connector.query('CREATE SCHEMA __sqlrooms_internal');
      await connector.query(
        'CREATE TABLE __sqlrooms_internal.test_table (id INT)',
      );

      // Create a normal schema
      await connector.query('CREATE SCHEMA visible_schema');
      await connector.query('CREATE TABLE visible_schema.test_table (id INT)');

      // Refresh schemas
      await store.getState().db.refreshTableSchemas();

      // Get the schema trees
      const schemaTrees = store.getState().db.schemaTrees;

      // Should NOT include internal schema
      const hasInternalSchema = schemaTrees.some((dbNode) =>
        dbNode.children?.some(
          (schemaNode) => schemaNode.object.name === '__sqlrooms_internal',
        ),
      );
      expect(hasInternalSchema).toBe(false);

      // Should include normal schema
      const hasVisibleSchema = schemaTrees.some((dbNode) =>
        dbNode.children?.some(
          (schemaNode) => schemaNode.object.name === 'visible_schema',
        ),
      );
      expect(hasVisibleSchema).toBe(true);
    });

    describe('with custom composed loadTableSchemasFilter', () => {
      beforeEach(async () => {
        await store.getState().db.destroy();
        store = createTestStoreWithCustomComposedFilter();
        await store.getState().db.initialize();
      });

      it('should hide schemas excluded by the custom filter from schemaTrees', async () => {
        const connector = await store.getState().db.getConnector();

        await connector.query('CREATE SCHEMA excluded_schema_alpha');
        await connector.query(
          'CREATE TABLE excluded_schema_alpha.test_table (id INT)',
        );

        await connector.query('CREATE SCHEMA excluded_schema_beta');
        await connector.query(
          'CREATE TABLE excluded_schema_beta.test_table (id INT)',
        );

        await connector.query('CREATE TEMP TABLE temp_test (id INT)');

        await connector.query('CREATE SCHEMA my_schema');
        await connector.query('CREATE TABLE my_schema.test_table (id INT)');

        await store.getState().db.refreshTableSchemas();

        const schemaTrees = store.getState().db.schemaTrees;

        const hasExcludedSchemas = schemaTrees.some((dbNode) =>
          dbNode.children?.some(
            (schemaNode) =>
              schemaNode.object.name === 'excluded_schema_alpha' ||
              schemaNode.object.name === 'temp' ||
              schemaNode.object.name === 'excluded_schema_beta',
          ),
        );
        expect(hasExcludedSchemas).toBe(false);

        const hasMySchema = schemaTrees.some((dbNode) =>
          dbNode.children?.some(
            (schemaNode) => schemaNode.object.name === 'my_schema',
          ),
        );
        expect(hasMySchema).toBe(true);
      });

      it('should hide a table name excluded by the custom filter', async () => {
        const connector = await store.getState().db.getConnector();

        await connector.query('CREATE TABLE excluded_table_name (id INT)');
        await connector.query('CREATE TABLE normal_table (id INT)');

        await store.getState().db.refreshTableSchemas();

        const tables = store.getState().db.tables;

        expect(
          tables.find((t) => t.table.table === 'excluded_table_name'),
        ).toBe(undefined);

        expect(
          tables.find((t) => t.table.table === 'normal_table'),
        ).toBeDefined();
      });
    });

    it('should show empty schema but hide __sqlrooms_* schemas simultaneously', async () => {
      const connector = await store.getState().db.getConnector();

      // Create both types of schemas
      await connector.query('CREATE SCHEMA empty_ok');
      await connector.query('CREATE SCHEMA __sqlrooms_hidden');
      await connector.query('CREATE SCHEMA another_empty');

      // Refresh schemas
      await store.getState().db.refreshTableSchemas();

      // Get the schema trees
      const schemaTrees = store.getState().db.schemaTrees;

      const schemaNames = schemaTrees.flatMap(
        (dbNode) =>
          dbNode.children?.map((schemaNode) => schemaNode.object.name) ?? [],
      );

      // Should include empty schemas
      expect(schemaNames).toContain('empty_ok');
      expect(schemaNames).toContain('another_empty');

      // Should NOT include internal schemas
      expect(schemaNames).not.toContain('__sqlrooms_hidden');
    });
  });
});
