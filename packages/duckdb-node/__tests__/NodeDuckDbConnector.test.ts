import {
  createNodeDuckDbConnector,
  NodeDuckDbConnector,
} from '../src/NodeDuckDbConnector';

describe('NodeDuckDbConnector', () => {
  let connector: NodeDuckDbConnector;

  beforeEach(async () => {
    connector = createNodeDuckDbConnector({
      dbPath: ':memory:',
    });
    await connector.initialize();
  });

  afterEach(async () => {
    await connector.destroy();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const newConnector = createNodeDuckDbConnector();
      await newConnector.initialize();
      expect(newConnector.type).toBe('node');
      await newConnector.destroy();
    });

    it('should be idempotent', async () => {
      await connector.initialize();
      await connector.initialize();
      expect(connector.type).toBe('node');
    });

    it('should run initialization query', async () => {
      const connectorWithInit = createNodeDuckDbConnector({
        initializationQuery: 'CREATE TABLE init_test (id INTEGER);',
      });
      await connectorWithInit.initialize();

      const result = await connectorWithInit.queryJson(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'init_test'",
      );
      const rows = Array.from(result);
      expect(rows.length).toBe(1);

      await connectorWithInit.destroy();
    });
  });

  describe('execute', () => {
    it('should execute DDL statements', async () => {
      await connector.execute(
        'CREATE TABLE test_exec (id INTEGER, name VARCHAR)',
      );

      const result = await connector.queryJson(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'test_exec'",
      );
      const rows = Array.from(result);
      expect(rows.length).toBe(1);
    });

    it('should execute INSERT statements', async () => {
      await connector.execute('CREATE TABLE test_insert (id INTEGER)');
      await connector.execute('INSERT INTO test_insert VALUES (1), (2), (3)');

      const result = await connector.queryJson<{count: number | string}>(
        'SELECT COUNT(*) as count FROM test_insert',
      );
      const rows = Array.from(result);
      // COUNT returns BIGINT which is serialized as string in JSON
      expect(Number(rows[0]?.count)).toBe(3);
    });
  });

  describe('query', () => {
    it('should return Arrow table for simple query', async () => {
      const table = await connector.query('SELECT 1 as value, 2 as other');

      expect(table.numRows).toBe(1);
      expect(table.numCols).toBe(2);
      expect(table.schema.fields.map((f) => f.name)).toEqual([
        'value',
        'other',
      ]);
    });

    it('should handle multiple rows', async () => {
      await connector.execute(
        'CREATE TABLE multi_row (id INTEGER, name VARCHAR)',
      );
      await connector.execute(
        "INSERT INTO multi_row VALUES (1, 'a'), (2, 'b'), (3, 'c')",
      );

      const table = await connector.query(
        'SELECT * FROM multi_row ORDER BY id',
      );

      expect(table.numRows).toBe(3);
      expect(table.numCols).toBe(2);
    });

    it('should handle various data types', async () => {
      const table = await connector.query(`
        SELECT 
          42 as int_val,
          3.14 as float_val,
          'hello' as str_val,
          true as bool_val,
          DATE '2024-01-15' as date_val
      `);

      expect(table.numRows).toBe(1);
      expect(table.numCols).toBe(5);
    });

    it('should handle NULL values', async () => {
      const table = await connector.query(
        'SELECT NULL as null_val, 1 as not_null',
      );

      expect(table.numRows).toBe(1);
      const nullCol = table.getChild('null_val');
      expect(nullCol?.get(0)).toBeNull();
    });

    it('should handle empty result', async () => {
      await connector.execute('CREATE TABLE empty_table (id INTEGER)');
      const table = await connector.query('SELECT * FROM empty_table');

      expect(table.numRows).toBe(0);
    });
  });

  describe('queryJson', () => {
    it('should return JSON objects', async () => {
      const result = await connector.queryJson<{value: number; name: string}>(
        "SELECT 42 as value, 'test' as name",
      );

      const rows = Array.from(result);
      expect(rows.length).toBe(1);
      expect(rows[0]).toEqual({value: 42, name: 'test'});
    });

    it('should handle multiple rows', async () => {
      await connector.execute(
        'CREATE TABLE json_test (id INTEGER, name VARCHAR)',
      );
      await connector.execute(
        "INSERT INTO json_test VALUES (1, 'one'), (2, 'two')",
      );

      const result = await connector.queryJson<{id: number; name: string}>(
        'SELECT * FROM json_test ORDER BY id',
      );

      const rows = Array.from(result);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual({id: 1, name: 'one'});
      expect(rows[1]).toEqual({id: 2, name: 'two'});
    });
  });

  describe('cancellation', () => {
    it('should support cancel via handle', async () => {
      const handle = connector.query('SELECT 1');

      // Should be able to cancel
      await expect(handle.cancel()).resolves.toBeUndefined();
    });

    it('should support external AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const handle = connector.query('SELECT 1', {signal: controller.signal});

      await expect(handle.result).rejects.toThrow();
    });
  });

  describe('getInstance and getConnection', () => {
    it('should return instance after initialization', () => {
      expect(() => connector.getInstance()).not.toThrow();
    });

    it('should return connection after initialization', () => {
      expect(() => connector.getConnection()).not.toThrow();
    });

    it('should throw before initialization', async () => {
      const uninitConnector = createNodeDuckDbConnector();

      expect(() => uninitConnector.getInstance()).toThrow(
        'DuckDB not initialized',
      );
      expect(() => uninitConnector.getConnection()).toThrow(
        'DuckDB not initialized',
      );
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      await connector.destroy();

      // After destroy, getInstance should throw
      expect(() => connector.getInstance()).toThrow('DuckDB not initialized');
    });

    it('should be safe to call multiple times', async () => {
      await connector.destroy();
      await connector.destroy();
      // Should not throw
    });
  });
});
