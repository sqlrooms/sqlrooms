import {
  toDataSourceCell,
  fromDataSourceCell,
  toDataSourceTable,
  fromDataSourceTable,
} from '../src/helpers';

describe('toDataSourceCell / fromDataSourceCell', () => {
  it('encodes and decodes basic cell IDs', () => {
    const cellId = 'abc123';
    const encoded = toDataSourceCell(cellId);
    expect(encoded).toBe('cell:abc123');
    expect(fromDataSourceCell(encoded)).toBe(cellId);
  });

  it('handles cell IDs with special characters', () => {
    const cellId = 'cell-with-dashes_and_underscores.and.dots';
    const encoded = toDataSourceCell(cellId);
    expect(encoded).toBe('cell:cell-with-dashes_and_underscores.and.dots');
    expect(fromDataSourceCell(encoded)).toBe(cellId);
  });

  it('returns undefined for non-cell values', () => {
    expect(fromDataSourceCell('table:something')).toBeUndefined();
    expect(fromDataSourceCell('random')).toBeUndefined();
  });
});

describe('toDataSourceTable / fromDataSourceTable', () => {
  describe('string input', () => {
    it('encodes and decodes basic table strings', () => {
      const table = 'main.flights';
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:main.flights');
      expect(fromDataSourceTable(encoded)).toBe(table);
    });

    it('preserves already-escaped identifiers', () => {
      const table = '"main"."flights"';
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"main"."flights"');
      expect(fromDataSourceTable(encoded)).toBe(table);
    });

    it('handles table names with special characters', () => {
      const table = '"weird-table#name"';
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"weird-table#name"');
      expect(fromDataSourceTable(encoded)).toBe(table);
    });

    it('handles table names with dots', () => {
      const table = '"my.funny.table"';
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"my.funny.table"');
      expect(fromDataSourceTable(encoded)).toBe(table);
    });
  });

  describe('QualifiedTableName object input', () => {
    it('encodes schema and table with escaping', () => {
      const table = {schema: 'main', table: 'flights'};
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"main"."flights"');
      expect(fromDataSourceTable(encoded)).toBe('"main"."flights"');
    });

    it('escapes dots in schema and table names', () => {
      const table = {schema: 'my.schema', table: 'my.table'};
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"my.schema"."my.table"');
      expect(fromDataSourceTable(encoded)).toBe('"my.schema"."my.table"');
    });

    it('escapes quotes in identifiers', () => {
      const table = {schema: 'my"schema', table: 'my"table'};
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"my""schema"."my""table"');
      expect(fromDataSourceTable(encoded)).toBe('"my""schema"."my""table"');
    });

    it('handles special characters in identifiers', () => {
      const table = {schema: 'main', table: 'weird-table#name'};
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"main"."weird-table#name"');
      expect(fromDataSourceTable(encoded)).toBe('"main"."weird-table#name"');
    });

    it('handles hyphens and underscores', () => {
      const table = {schema: 'my-schema_1', table: 'my-table_2'};
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"my-schema_1"."my-table_2"');
      expect(fromDataSourceTable(encoded)).toBe('"my-schema_1"."my-table_2"');
    });

    it('handles only table when schema is undefined', () => {
      const table = {table: 'flights', schema: undefined};
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"flights"');
      expect(fromDataSourceTable(encoded)).toBe('"flights"');
    });

    it('escapes complex combination of special characters', () => {
      const table = {
        schema: 'my.sch"ema',
        table: 'my.ta"ble#with-specials',
      };
      const encoded = toDataSourceTable(table);
      expect(encoded).toBe('table:"my.sch""ema"."my.ta""ble#with-specials"');
      expect(fromDataSourceTable(encoded)).toBe(
        '"my.sch""ema"."my.ta""ble#with-specials"',
      );
    });
  });

  it('returns undefined for non-table values', () => {
    expect(fromDataSourceTable('cell:something')).toBeUndefined();
    expect(fromDataSourceTable('random')).toBeUndefined();
  });
});
