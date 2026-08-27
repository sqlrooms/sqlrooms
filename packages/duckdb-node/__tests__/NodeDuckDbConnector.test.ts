import * as arrow from 'apache-arrow';
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
    // Give some time for any pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
    await connector.destroy();
    // Ensure cleanup is complete before next test
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const newConnector = createNodeDuckDbConnector();
      await newConnector.initialize();
      // Verify it works by running a query
      const result = await newConnector.query('SELECT 1 as test');
      expect(result.numRows).toBe(1);
      await newConnector.destroy();
    });

    it('should be idempotent', async () => {
      await connector.initialize();
      await connector.initialize();
      // Verify it still works
      const result = await connector.query('SELECT 1 as test');
      expect(result.numRows).toBe(1);
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

    // BLOB columns used to be rendered through DuckDB's BLOB-to-VARCHAR
    // escaping and inferred as `Dictionary<Int32, Utf8>`, which has no
    // `valueOffsets`. Consumers reading binary columns positionally (kepler.gl's
    // WKB geometry reader indexes `chunk.valueOffsets[i + 1]`) crashed with
    // `Cannot read properties of undefined (reading '1')`.
    it('should return BLOB columns as Arrow Binary, not strings', async () => {
      const table = await connector.query(
        "SELECT 'abc'::BLOB as blob_val, 1 as other",
      );

      const col = table.getChild('blob_val');
      expect(col?.type).toBeInstanceOf(arrow.Binary);
      expect(col?.data[0]?.valueOffsets).toBeDefined();
      expect(Array.from(col?.get(0) as Uint8Array)).toEqual([0x61, 0x62, 0x63]);
    });

    it('should preserve BLOB bytes that are not valid UTF-8', async () => {
      // \x00 and \xff do not survive a round trip through a JS string, so this
      // fails loudly if BLOBs are ever stringified again.
      const table = await connector.query(
        "SELECT '\\x00\\x01\\xFF'::BLOB as blob_val",
      );

      expect(
        Array.from(table.getChild('blob_val')?.get(0) as Uint8Array),
      ).toEqual([0x00, 0x01, 0xff]);
    });

    it('should handle NULL and multi-row BLOB columns', async () => {
      const table = await connector.query(`
        SELECT * FROM (VALUES
          ('a'::BLOB),
          (NULL),
          ('cc'::BLOB)
        ) AS t(blob_val)
      `);

      const col = table.getChild('blob_val');
      expect(table.numRows).toBe(3);
      expect(col?.type).toBeInstanceOf(arrow.Binary);
      expect(Array.from(col?.get(0) as Uint8Array)).toEqual([0x61]);
      expect(col?.get(1)).toBeNull();
      expect(Array.from(col?.get(2) as Uint8Array)).toEqual([0x63, 0x63]);
    });
  });

  // `to_arrow_ipc()` is the only conversion path, so these assert the types the
  // JS value conversion could never produce.
  describe('Arrow type fidelity', () => {
    it('should preserve DuckDB types that JS values cannot represent', async () => {
      const table = await connector.query(`
        SELECT
          TIMESTAMP '2024-01-02 03:04:05' as ts,
          DATE '2024-01-02' as d,
          9007199254740993::BIGINT as big,
          1.25::DECIMAL(10,4) as dec,
          [1, 2, 3] as lst,
          {'a': 1} as strct,
          NULL::INTEGER as allnull
      `);

      // Decoded IPC yields the generic type classes (`Int_`, not `Int64`), so
      // compare the rendered type instead of the constructor.
      const typeOf = (name: string) => String(table.getChild(name)?.type);
      expect(typeOf('ts')).toBe('Timestamp<MICROSECOND>');
      expect(typeOf('d')).toBe('Date32<DAY>');
      expect(typeOf('big')).toBe('Int64');
      expect(typeOf('dec')).toMatch(/^Decimal/);
      expect(typeOf('lst')).toBe('List<Int32>');
      expect(typeOf('strct')).toBe('Struct<{a:Int32}>');
      expect(typeOf('allnull')).toBe('Int32');
      // Beyond Number.MAX_SAFE_INTEGER: only a real Int64 keeps this exact.
      expect(table.getChild('big')?.get(0)).toBe(9007199254740993n);
    });
  });

  // `to_arrow_ipc()` only wraps a single sub-selectable statement, so anything
  // else has to be routed around it without losing rows.
  describe('statements to_arrow_ipc cannot wrap', () => {
    it('should run DDL and DML', async () => {
      await connector.query('CREATE TABLE stmt_test (id INTEGER)');
      await connector.query('INSERT INTO stmt_test VALUES (7)');

      const table = await connector.query('SELECT id FROM stmt_test');
      expect(table.numRows).toBe(1);
      expect(table.getChild('id')?.get(0)).toBe(7);
    });

    it('should preserve the row count returned by CREATE TABLE AS', async () => {
      const table = await connector.query(`
        CREATE TABLE counted_create AS
        SELECT * FROM (VALUES (1), (2), (3)) AS t(id)
      `);

      expect(table.numRows).toBe(1);
      expect(Number(table.getChild('Count')?.get(0))).toBe(3);
    });

    it('should return rows from the last statement of a script', async () => {
      // The regression this guards: running the script for its side effects and
      // returning an empty table would silently drop these rows.
      const table = await connector.query(
        "SET default_null_order='nulls_last'; SELECT 42 as answer",
      );

      expect(table.numRows).toBe(1);
      expect(table.getChild('answer')?.get(0)).toBe(42);
    });

    it('should apply every leading statement of a script', async () => {
      const table = await connector.query(
        `CREATE TABLE script_test (id INTEGER);
         INSERT INTO script_test VALUES (1), (2);
         SELECT count(*)::INTEGER as n FROM script_test`,
      );

      expect(table.getChild('n')?.get(0)).toBe(2);
    });

    it('should split on the parse, not on semicolons', async () => {
      // A `;` inside a string literal must not be treated as a boundary.
      const table = await connector.query(
        `SET default_null_order='nulls_last'; SELECT 'a;b' as semi`,
      );

      expect(table.getChild('semi')?.get(0)).toBe('a;b');
    });

    it('should accept repeated trailing statement terminators', async () => {
      const table = await connector.query('SELECT 42 as answer;;;');

      expect(table.getChild('answer')?.get(0)).toBe(42);
    });

    it.each([
      ['line', 'SELECT 42 as answer;;; -- explanation'],
      ['block', 'SELECT 42 as answer;;; /* explanation */'],
      ['nested block', 'SELECT 42 as answer;;; /* outer /* inner */ outer */'],
    ])(
      'should accept a terminator before a trailing %s comment',
      async (_, sql) => {
        const table = await connector.query(sql);

        expect(table.getChild('answer')?.get(0)).toBe(42);
      },
    );

    it('should preserve rows and types from INSERT RETURNING', async () => {
      await connector.query(
        `CREATE TABLE returning_test (
          id INTEGER,
          ts TIMESTAMP,
          d DATE,
          dec_value DECIMAL(10,4),
          lst INTEGER[],
          strct STRUCT(a INTEGER),
          payload BLOB
        )`,
      );

      const table = await connector.query(`
        INSERT INTO returning_test VALUES (
          7,
          TIMESTAMP '2024-01-02 03:04:05.123456',
          DATE '2024-01-02',
          1.25,
          [1, 2],
          {'a': 1},
          '\\xFF'::BLOB
        ) RETURNING *, NULL::INTEGER AS typed_null
      `);

      expect(table.numRows).toBe(1);
      expect(table.getChild('id')?.get(0)).toBe(7);
      const typeOf = (name: string) => String(table.getChild(name)?.type);
      expect(typeOf('id')).toBe('Int32');
      expect(typeOf('ts')).toBe('Timestamp<MICROSECOND>');
      expect(typeOf('d')).toBe('Date32<DAY>');
      expect(typeOf('dec_value')).toMatch(/^Decimal/);
      expect(typeOf('lst')).toBe('List<Int32>');
      expect(typeOf('strct')).toBe('Struct<{a:Int32}>');
      expect(typeOf('typed_null')).toBe('Int32');
      expect(table.getChild('typed_null')?.get(0)).toBeNull();
      expect(table.getChild('payload')?.type).toBeInstanceOf(arrow.Binary);
      expect(
        Array.from(table.getChild('payload')?.get(0) as Uint8Array),
      ).toEqual([0xff]);
    });

    it('should serialize concurrent operations on the shared connection', async () => {
      const connection = connector.getConnection();
      const extractStatements = connection.extractStatements.bind(connection);
      let releaseFirst!: () => void;
      const firstCanContinue = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let markFirstStarted!: () => void;
      const firstStarted = new Promise<void>((resolve) => {
        markFirstStarted = resolve;
      });
      let shouldBlockFirst = true;
      let secondStarted = false;
      connection.extractStatements = async (sql) => {
        if (sql.includes('first_value') && shouldBlockFirst) {
          shouldBlockFirst = false;
          markFirstStarted();
          await firstCanContinue;
        }
        if (sql.includes('second_value')) {
          secondStarted = true;
        }
        return extractStatements(sql);
      };

      const first = connector.query('SELECT 1 AS first_value');
      await firstStarted;
      const second = connector.query('SELECT 2 AS second_value');
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(secondStarted).toBe(false);
      } finally {
        releaseFirst();
      }

      const [firstTable, secondTable] = await Promise.all([first, second]);
      expect(firstTable.getChild('first_value')?.get(0)).toBe(1);
      expect(secondTable.getChild('second_value')?.get(0)).toBe(2);
      expect(secondStarted).toBe(true);
      connection.extractStatements = extractStatements;
    });

    it('should not reparse semicolons inside the final statement', async () => {
      const connection = connector.getConnection();
      const extractStatements = connection.extractStatements.bind(connection);
      let extractCount = 0;
      connection.extractStatements = async (sql) => {
        extractCount++;
        return extractStatements(sql);
      };

      const semicolons = ';'.repeat(200);
      try {
        const table = await connector.query(
          `SET default_null_order='nulls_last'; SELECT E'a\\';${semicolons}' AS semicolons`,
        );
        expect(table.getChild('semicolons')?.get(0)).toBe(`a';${semicolons}`);
        expect(extractCount).toBeLessThanOrEqual(3);
      } finally {
        connection.extractStatements = extractStatements;
      }
    });

    it('should surface the real error for a broken query', async () => {
      await expect(
        connector.query('SELECT * FROM no_such_table_here'),
      ).rejects.toThrow(/no_such_table_here/);
    });

    it('should surface the real error for broken syntax', async () => {
      await expect(connector.query('SELEKT 1')).rejects.toThrow();
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
    // Skip cancellation tests - native DuckDB doesn't support query interruption
    // and attempting to cancel can cause segfaults when the connection is closed
    // while a query is still running in the native module
    it.skip('should support cancel via handle', async () => {
      const handle = connector.query('SELECT 1');

      // Should be able to cancel
      await expect(handle.cancel()).resolves.toBeUndefined();
    });

    it('should reject when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const handle = connector.query('SELECT 1', {signal: controller.signal});

      // Should reject with AbortError before query starts
      let rejected = false;
      try {
        await handle.result;
      } catch {
        rejected = true;
      }
      expect(rejected).toBe(true);
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
    it('should reject operations and initialization after teardown starts', async () => {
      const connection = connector.getConnection();
      const extractStatements = connection.extractStatements.bind(connection);
      let releaseQuery!: () => void;
      const queryCanContinue = new Promise<void>((resolve) => {
        releaseQuery = resolve;
      });
      let markQueryStarted!: () => void;
      const queryStarted = new Promise<void>((resolve) => {
        markQueryStarted = resolve;
      });
      let shouldBlock = true;
      connection.extractStatements = async (sql) => {
        if (shouldBlock) {
          shouldBlock = false;
          markQueryStarted();
          await queryCanContinue;
        }
        return extractStatements(sql);
      };

      const activeQuery = connector.query('SELECT 1 AS active');
      await queryStarted;
      const destroying = connector.destroy();
      try {
        await expect(connector.query('SELECT 2 AS too_late')).rejects.toThrow(
          'DuckDB connector is shutting down',
        );
        await expect(connector.initialize()).rejects.toThrow(
          'DuckDB connector is shutting down',
        );
      } finally {
        releaseQuery();
      }

      await expect(activeQuery).resolves.toBeDefined();
      await destroying;
      connection.extractStatements = extractStatements;
    });

    it('should clean up resources', async () => {
      await connector.destroy();

      // After destroy, getInstance should throw
      expect(() => connector.getInstance()).toThrow('DuckDB not initialized');
    });

    it('should allow initialization after teardown finishes', async () => {
      await connector.destroy();
      await connector.initialize();

      await expect(connector.query('SELECT 1')).resolves.toBeDefined();
    });

    it('should be safe to call multiple times', async () => {
      await connector.destroy();
      await connector.destroy();
      // Should not throw
    });
  });
});
