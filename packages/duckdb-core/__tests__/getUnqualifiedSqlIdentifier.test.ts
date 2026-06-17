import {
  getUnqualifiedSqlIdentifier,
  parseQualifiedSqlIdentifier,
} from '../src/duckdb-utils';

describe('parseQualifiedSqlIdentifier', () => {
  it('returns undefined for empty input', () => {
    expect(parseQualifiedSqlIdentifier(undefined)).toBeUndefined();
    expect(parseQualifiedSqlIdentifier('')).toBeUndefined();
    expect(parseQualifiedSqlIdentifier('   ')).toBeUndefined();
  });

  it('parses unqualified, schema-qualified, and database-qualified names', () => {
    expect(parseQualifiedSqlIdentifier('events')).toEqual({table: 'events'});
    expect(parseQualifiedSqlIdentifier('main.events')).toEqual({
      schema: 'main',
      table: 'events',
    });
    expect(parseQualifiedSqlIdentifier('memory.main.events')).toEqual({
      database: 'memory',
      schema: 'main',
      table: 'events',
    });
  });

  it('handles dots and escaped quotes inside quoted identifier segments', () => {
    expect(
      parseQualifiedSqlIdentifier('"memory"."ma.in"."event""log.2026"'),
    ).toEqual({
      database: 'memory',
      schema: 'ma.in',
      table: 'event"log.2026',
    });
  });

  it('returns undefined for names with too many unquoted segments', () => {
    expect(parseQualifiedSqlIdentifier('a.b.c.d')).toBeUndefined();
  });

  it('returns undefined for malformed names', () => {
    expect(parseQualifiedSqlIdentifier('schema.')).toBeUndefined();
    expect(parseQualifiedSqlIdentifier('schema."events')).toBeUndefined();
  });
});

describe('getUnqualifiedSqlIdentifier', () => {
  it('returns undefined for empty input', () => {
    expect(getUnqualifiedSqlIdentifier(undefined)).toBeUndefined();
    expect(getUnqualifiedSqlIdentifier('')).toBeUndefined();
    expect(getUnqualifiedSqlIdentifier('   ')).toBeUndefined();
  });

  it('keeps an unqualified identifier unchanged', () => {
    expect(getUnqualifiedSqlIdentifier('result_1')).toBe('result_1');
  });

  it('extracts last segment from qualified names', () => {
    expect(getUnqualifiedSqlIdentifier('schema.result_1')).toBe('result_1');
    expect(getUnqualifiedSqlIdentifier('db.schema.result_1')).toBe('result_1');
  });

  it('handles dots inside quoted identifiers', () => {
    expect(getUnqualifiedSqlIdentifier('myschema."my.funny.table"')).toBe(
      'my.funny.table',
    );
    expect(
      getUnqualifiedSqlIdentifier('db."sch.ema"."ta.ble.with.more.dots"'),
    ).toBe('ta.ble.with.more.dots');
  });

  it('unescapes doubled quotes in quoted identifiers', () => {
    expect(getUnqualifiedSqlIdentifier('myschema."my""table"')).toBe(
      'my"table',
    );
  });
});
