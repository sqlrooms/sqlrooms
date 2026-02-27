import {getUnqualifiedSqlIdentifier} from '../src/helpers';

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
