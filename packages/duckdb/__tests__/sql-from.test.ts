import {sqlFrom, literalToSQL} from '../src/connectors/load/sql-from';

describe('sql-from', () => {
  describe('literalToSQL', () => {
    it('should convert numbers correctly', () => {
      expect(literalToSQL(42)).toBe('42');
      expect(literalToSQL(3.14)).toBe('3.14');
      expect(literalToSQL(Infinity)).toBe('NULL');
      expect(literalToSQL(NaN)).toBe('NULL');
    });

    it('should convert strings correctly', () => {
      expect(literalToSQL('hello')).toBe("'hello'");
      expect(literalToSQL("O'Neil")).toBe("'O''Neil'"); // Escapes single quotes
      expect(literalToSQL("a'b'c")).toBe("'a''b''c'");
    });

    it('should convert booleans correctly', () => {
      expect(literalToSQL(true)).toBe('TRUE');
      expect(literalToSQL(false)).toBe('FALSE');
    });

    it('should convert dates correctly', () => {
      const date = new Date('2024-02-05');
      expect(literalToSQL(date)).toMatch(/^DATE '\d{4}-\d{1,2}-\d{1,2}'$/);

      const timestamp = new Date('2024-02-05T12:30:00Z');
      expect(literalToSQL(timestamp)).toMatch(/^epoch_ms\(\d+\)$/);
    });

    it('should handle null and undefined', () => {
      expect(literalToSQL(null)).toBe('NULL');
      expect(literalToSQL(undefined)).toBe('NULL');
    });

    it('should convert RegExp to string', () => {
      expect(literalToSQL(/test/)).toBe("'test'");
    });
  });

  describe('sqlFrom', () => {
    it('should create SQL query from array of objects', () => {
      const data = [
        {id: 1, name: 'John'},
        {id: 2, name: 'Jane'},
      ] as Record<string, unknown>[];

      const result = sqlFrom(data);
      expect(result).toBe(
        '(SELECT 1 AS "id", \'John\' AS "name") ' +
          'UNION ALL ' +
          '(SELECT 2 AS "id", \'Jane\' AS "name")',
      );
    });

    it('should handle custom column mapping', () => {
      const data = [
        {id: 1, firstName: 'John'},
        {id: 2, firstName: 'Jane'},
      ] as Record<string, unknown>[];

      const result = sqlFrom(data, {
        columns: {id: 'user_id', firstName: 'name'},
      });
      expect(result).toBe(
        '(SELECT 1 AS "user_id", \'John\' AS "name") ' +
          'UNION ALL ' +
          '(SELECT 2 AS "user_id", \'Jane\' AS "name")',
      );
    });

    it('should handle column subset selection', () => {
      const data = [
        {id: 1, name: 'John', age: 30},
        {id: 2, name: 'Jane', age: 25},
      ] as Record<string, unknown>[];

      const result = sqlFrom(data, {columns: ['id', 'name']});
      expect(result).toBe(
        '(SELECT 1 AS "id", \'John\' AS "name") ' +
          'UNION ALL ' +
          '(SELECT 2 AS "id", \'Jane\' AS "name")',
      );
    });

    it('should throw error for empty column set', () => {
      const data = [] as Record<string, unknown>[];
      expect(() => sqlFrom(data)).toThrow(
        'Can not create table from empty column set.',
      );
    });
  });
});
