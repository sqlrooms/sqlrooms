import {Table, Utf8, vectorFromArray} from 'apache-arrow';
import {
  createDescribeDatasetSql,
  geometryColumnsNeedingWkbWrap,
  isDuckDbNativeGeometryType,
  parseDescribeSqlColumns,
  wrapSqlGeometryColumnsAsWkb,
} from '../src/datasets/wrapGeometryAsWkb';

describe('wrapGeometryAsWkb', () => {
  test('detects native DuckDB GEOMETRY types only', () => {
    expect(isDuckDbNativeGeometryType('GEOMETRY')).toBe(true);
    expect(isDuckDbNativeGeometryType('geometry')).toBe(true);
    expect(isDuckDbNativeGeometryType('BLOB')).toBe(false);
    expect(isDuckDbNativeGeometryType('WKB_BLOB')).toBe(false);
    expect(isDuckDbNativeGeometryType('geoarrow.point')).toBe(false);
  });

  test('builds DESCRIBE SQL around a dataset query', () => {
    expect(createDescribeDatasetSql('SELECT * FROM places;')).toBe(
      'DESCRIBE SELECT * FROM (SELECT * FROM places) AS "__sqlrooms_describe_source"',
    );
  });

  test('parses DESCRIBE columns and selects GEOMETRY names', () => {
    const table = new Table({
      column_name: vectorFromArray(['id', 'geom', 'source_geom'], new Utf8()),
      column_type: vectorFromArray(
        ['BIGINT', 'GEOMETRY', 'GEOMETRY'],
        new Utf8(),
      ),
    });
    const columns = parseDescribeSqlColumns(table);
    expect(columns).toEqual([
      {name: 'id', type: 'BIGINT'},
      {name: 'geom', type: 'GEOMETRY'},
      {name: 'source_geom', type: 'GEOMETRY'},
    ]);
    expect(geometryColumnsNeedingWkbWrap(columns)).toEqual([
      'geom',
      'source_geom',
    ]);
  });

  test('wraps GEOMETRY columns with SELECT * REPLACE (ST_AsWKB...)', () => {
    const wrapped = wrapSqlGeometryColumnsAsWkb('SELECT * FROM places', [
      'geom',
      'source_geom',
    ]);
    expect(wrapped).toBe(
      [
        'SELECT * REPLACE (ST_AsWKB("geom") AS "geom", ST_AsWKB("source_geom") AS "source_geom")',
        'FROM (SELECT * FROM places) AS "__sqlrooms_as_wkb"',
      ].join('\n'),
    );
  });

  test('returns null when there are no geometry columns to wrap', () => {
    expect(wrapSqlGeometryColumnsAsWkb('SELECT 1', [])).toBeNull();
  });
});
