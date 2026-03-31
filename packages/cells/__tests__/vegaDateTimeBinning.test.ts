import {wrapQueryWithDateTimeBinning} from '../src/vegaDateTimeBinning';

describe('wrapQueryWithDateTimeBinning', () => {
  describe('basic time scales', () => {
    const baseQuery = 'SELECT timestamp, value FROM table';
    const xField = 'timestamp';
    const yField = 'value';

    it('applies minute binning with SUM', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'minute',
        yField,
        'sum',
      );
      expect(result).toContain('WITH _vega_base AS');
      expect(result).toContain("DATE_TRUNC('minute'");
      expect(result).toContain('CAST(');
      expect(result).toContain('AS VARCHAR');
      expect(result).toContain('AS "timestamp"');
      expect(result).toContain('SUM("value")');
      expect(result).toContain('GROUP BY DATE_TRUNC');
      expect(result).toContain('ORDER BY DATE_TRUNC');
    });

    it('applies hour binning with SUM', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'hour',
        yField,
        'sum',
      );
      expect(result).toContain("DATE_TRUNC('hour'");
      expect(result).toContain('SUM("value")');
    });

    it('applies day binning with SUM', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'day',
        yField,
        'sum',
      );
      expect(result).toContain("DATE_TRUNC('day'");
      expect(result).toContain('SUM("value")');
    });

    it('applies month binning with SUM', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'month',
        yField,
        'sum',
      );
      expect(result).toContain("DATE_TRUNC('month'");
      expect(result).toContain('SUM("value")');
    });

    it('applies year binning with SUM', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'year',
        yField,
        'sum',
      );
      expect(result).toContain("DATE_TRUNC('year'");
      expect(result).toContain('SUM("value")');
    });
  });

  describe('different aggregations', () => {
    const baseQuery = 'SELECT timestamp, value FROM table';
    const xField = 'timestamp';
    const yField = 'value';

    it('applies MEAN aggregation', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'day',
        yField,
        'mean',
      );
      expect(result).toContain('AVG("value")');
      expect(result).toContain('AS "value"');
    });

    it('applies COUNT aggregation without yField', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'day',
        undefined,
        'count',
      );
      expect(result).toContain('COUNT(*)');
      expect(result).toContain('AS "count"');
      expect(result).not.toContain('"value"');
    });

    it('applies COUNT aggregation with yField (yField ignored)', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        xField,
        'day',
        yField,
        'count',
      );
      expect(result).toContain('COUNT(*)');
      expect(result).toContain('AS "count"');
    });
  });

  describe('complex queries', () => {
    it('handles queries with WHERE clauses', () => {
      const query =
        "SELECT timestamp, value FROM table WHERE value > 100 AND status = 'active'";
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('WITH _vega_base AS');
      expect(result).toContain('WHERE value > 100');
      expect(result).toContain("status = 'active'");
      expect(result).toContain('SUM("value")');
    });

    it('handles queries with JOINs', () => {
      const query = `SELECT t1.timestamp, t2.value
        FROM table1 t1
        JOIN table2 t2 ON t1.id = t2.id`;
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('WITH _vega_base AS');
      expect(result).toContain('JOIN table2 t2');
      expect(result).toContain('SUM("value")');
    });

    it('handles queries with multiple statements', () => {
      const query = `CREATE TEMP TABLE temp AS SELECT * FROM source;
        SELECT timestamp, value FROM temp`;
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'month',
        'value',
        'mean',
      );
      expect(result).toContain('CREATE TEMP TABLE temp');
      expect(result).toContain('WITH _vega_base AS');
      expect(result).toContain('SELECT timestamp, value FROM temp');
      expect(result).toContain('AVG("value")');
    });

    it('handles queries with subqueries', () => {
      const query = `SELECT timestamp, value FROM (
        SELECT * FROM raw_table WHERE status = 'active'
      ) AS filtered`;
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('WITH _vega_base AS');
      expect(result).toContain('AS filtered');
      expect(result).toContain('SUM("value")');
    });
  });

  describe('field escaping', () => {
    it('properly escapes field names with special characters', () => {
      const query = 'SELECT "my-timestamp", "my-value" FROM table';
      const result = wrapQueryWithDateTimeBinning(
        query,
        'my-timestamp',
        'day',
        'my-value',
        'sum',
      );
      expect(result).toContain('"my-timestamp"');
      expect(result).toContain('"my-value"');
      expect(result).toContain('DATE_TRUNC(\'day\', "my-timestamp")');
      expect(result).toContain('SUM("my-value")');
    });

    it('handles field names with dots', () => {
      const query = 'SELECT t1.timestamp, t2.value FROM table1 t1';
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('"timestamp"');
      expect(result).toContain('"value"');
    });
  });

  describe('query structure', () => {
    const baseQuery = 'SELECT timestamp, value FROM table';

    it('creates proper CTE structure', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      // Check CTE declaration
      expect(result).toMatch(/WITH _vega_base AS \(/);
      // Check CTE content
      expect(result).toContain('SELECT timestamp, value FROM table');
      // Check main query references CTE
      expect(result).toContain('FROM _vega_base');
    });

    it('orders results by timestamp', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('ORDER BY DATE_TRUNC');
    });

    it('groups by truncated timestamp', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('GROUP BY DATE_TRUNC(\'day\', "timestamp")');
    });

    it('preserves original field name in output', () => {
      const result = wrapQueryWithDateTimeBinning(
        baseQuery,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      // Truncated field should be aliased back to original name
      expect(result).toContain('AS "timestamp"');
      expect(result).toContain('AS "value"');
    });
  });

  describe('edge cases', () => {
    it('handles query with trailing semicolon', () => {
      const query = 'SELECT timestamp, value FROM table;';
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('WITH _vega_base AS');
      expect(result).toContain('SUM("value")');
    });

    it('handles query with multiple trailing semicolons', () => {
      const query = 'SELECT timestamp, value FROM table;;';
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        'value',
        'sum',
      );
      expect(result).toContain('WITH _vega_base AS');
    });

    it('handles empty yField with sum (falls back to count)', () => {
      const query = 'SELECT timestamp FROM table';
      const result = wrapQueryWithDateTimeBinning(
        query,
        'timestamp',
        'day',
        undefined,
        'sum',
      );
      // Should fall back to COUNT when no yField
      expect(result).toContain('COUNT(*)');
    });
  });

  describe('edge cases - empty queries', () => {
    it('should not be called with empty string', () => {
      // This test documents that the guard in useVegaCellQuery
      // should prevent empty queries from reaching this function
      expect(() =>
        wrapQueryWithDateTimeBinning('', 'field', 'day', 'value', 'sum'),
      ).toThrow('Query must contain at least one statement');
    });

    it('should not be called with whitespace-only string', () => {
      expect(() =>
        wrapQueryWithDateTimeBinning('   \n  ', 'field', 'day', 'value', 'sum'),
      ).toThrow('Query must contain at least one statement');
    });
  });
});
