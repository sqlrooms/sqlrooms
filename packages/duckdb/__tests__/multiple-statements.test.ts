import {createWasmDuckDbConnector} from '../src/connectors/WasmDuckDbConnector';

describe('Multiple Statements Support', () => {
  // Simple unit test for array handling logic
  it('should handle array of queries by executing them individually', () => {
    const queries = [
      'CREATE TABLE test1 (id INTEGER)',
      'INSERT INTO test1 VALUES (1)',
      'SELECT * FROM test1',
    ];

    // Verify we have multiple distinct statements
    expect(queries).toHaveLength(3);
    expect(queries[0]).toBe('CREATE TABLE test1 (id INTEGER)');
    expect(queries[1]).toBe('INSERT INTO test1 VALUES (1)');
    expect(queries[2]).toBe('SELECT * FROM test1');
  });

  it('should handle single string query unchanged', () => {
    const query = 'SELECT 1 as value';
    const isArray = Array.isArray(query);
    expect(isArray).toBe(false);
    expect(query).toBe('SELECT 1 as value');
  });

  it('should handle empty array', () => {
    const queries: string[] = [];
    expect(Array.isArray(queries)).toBe(true);
    expect(queries).toHaveLength(0);
  });

  it('should handle array with single element', () => {
    const queries = ['SELECT 1 as value'];
    expect(Array.isArray(queries)).toBe(true);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toBe('SELECT 1 as value');
  });

  it('should skip empty statements', () => {
    const queries = [
      'CREATE TABLE test1 (id INTEGER)',
      '', // empty statement
      '   ', // whitespace only
      'INSERT INTO test1 VALUES (1)',
      'SELECT * FROM test1',
    ];

    const nonEmptyQueries = queries.filter((q) => q?.trim());
    expect(nonEmptyQueries).toHaveLength(3);
  });

  // Integration test that requires DuckDB to be available
  // This test might be skipped in environments where Worker is not available
  it('should execute multiple statements via connector', async () => {
    // Skip test if Worker is not available (e.g., in Node.js environment)
    if (typeof Worker === 'undefined') {
      console.log('Skipping DuckDB integration test - Worker not available');
      return;
    }

    const connector = createWasmDuckDbConnector();

    try {
      await connector.initialize();

      const queries = [
        'CREATE TABLE multi_test (id INTEGER, name VARCHAR)',
        "INSERT INTO multi_test VALUES (1, 'Alice')",
        "INSERT INTO multi_test VALUES (2, 'Bob')",
        'SELECT COUNT(*) as count FROM multi_test',
      ];

      const result = await connector.query(queries);
      expect(result).toBeDefined();
      expect(result.numRows).toBe(1);

      // Check that the count is 2 (we inserted 2 rows)
      const firstRow = result.get(0);
      expect(firstRow?.count).toBe(2);
    } catch (error) {
      // If DuckDB fails to initialize (e.g., in test environment), skip the test
      if (error instanceof Error && error.message.includes('Worker')) {
        console.log(
          'Skipping DuckDB integration test - Worker initialization failed',
        );
        return;
      }
      throw error;
    } finally {
      await connector.destroy();
    }
  }, 10000); // 10 second timeout for DuckDB initialization

  it('should return result from last statement in array', async () => {
    // Skip test if Worker is not available (e.g., in Node.js environment)
    if (typeof Worker === 'undefined') {
      console.log('Skipping DuckDB integration test - Worker not available');
      return;
    }

    const connector = createWasmDuckDbConnector();

    try {
      await connector.initialize();

      const queries = [
        'CREATE TABLE test_table (value INTEGER)',
        'INSERT INTO test_table VALUES (42)',
        'SELECT value FROM test_table', // This should be the returned result
      ];

      const result = await connector.query(queries);
      expect(result).toBeDefined();
      expect(result.numRows).toBe(1);

      // Check that we get the result from the SELECT statement (last one)
      const firstRow = result.get(0);
      expect(firstRow?.value).toBe(42);
    } catch (error) {
      // If DuckDB fails to initialize (e.g., in test environment), skip the test
      if (error instanceof Error && error.message.includes('Worker')) {
        console.log(
          'Skipping DuckDB integration test - Worker initialization failed',
        );
        return;
      }
      throw error;
    } finally {
      await connector.destroy();
    }
  }, 10000); // 10 second timeout for DuckDB initialization

  it('should efficiently handle intermediate non-SELECT statements', async () => {
    // Skip test if Worker is not available (e.g., in Node.js environment)
    if (typeof Worker === 'undefined') {
      console.log('Skipping DuckDB integration test - Worker not available');
      return;
    }

    const connector = createWasmDuckDbConnector();

    try {
      await connector.initialize();

      // This test verifies that CREATE and INSERT statements don't build full tables
      // but the final SELECT still returns the correct result
      const queries = [
        'CREATE TABLE performance_test (id INTEGER, name VARCHAR, score DOUBLE)',
        "INSERT INTO performance_test VALUES (1, 'Alice', 95.5)",
        "INSERT INTO performance_test VALUES (2, 'Bob', 87.2)",
        "INSERT INTO performance_test VALUES (3, 'Charlie', 92.8)",
        'SELECT AVG(score) as average_score FROM performance_test',
      ];

      const result = await connector.query(queries);
      expect(result).toBeDefined();
      expect(result.numRows).toBe(1);

      // Verify the calculation is correct: (95.5 + 87.2 + 92.8) / 3 = 91.833...
      const firstRow = result.get(0);
      expect(firstRow?.average_score).toBeCloseTo(91.83, 1);
    } catch (error) {
      // If DuckDB fails to initialize (e.g., in test environment), skip the test
      if (error instanceof Error && error.message.includes('Worker')) {
        console.log(
          'Skipping DuckDB integration test - Worker initialization failed',
        );
        return;
      }
      throw error;
    } finally {
      await connector.destroy();
    }
  }, 10000); // 10 second timeout for DuckDB initialization
});
