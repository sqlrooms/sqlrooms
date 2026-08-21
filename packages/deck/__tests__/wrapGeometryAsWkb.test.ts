import {Table, Utf8, vectorFromArray} from 'apache-arrow';
import {
  createDescribeDatasetSql,
  describedColumnsIncludeGeometry,
  geometryColumnsNeedingWkbWrap,
  isDuckDbNativeGeometryType,
  parseDescribeSqlColumns,
  wrapSqlGeometryColumnsAsWkb,
} from '../src/datasets/wrapGeometryAsWkb';

describe('wrapGeometryAsWkb', () => {
  test('detects native DuckDB GEOMETRY types only', () => {
    expect(isDuckDbNativeGeometryType('GEOMETRY')).toBe(true);
    expect(isDuckDbNativeGeometryType('geometry')).toBe(true);
    expect(isDuckDbNativeGeometryType(' GEOMETRY ')).toBe(true);
    expect(isDuckDbNativeGeometryType("GEOMETRY('EPSG:4326')")).toBe(true);
    expect(isDuckDbNativeGeometryType("GEOMETRY('OGC:CRS84')")).toBe(true);
    expect(isDuckDbNativeGeometryType('BLOB')).toBe(false);
    expect(isDuckDbNativeGeometryType('WKB_BLOB')).toBe(false);
    expect(isDuckDbNativeGeometryType('geoarrow.point')).toBe(false);
    expect(isDuckDbNativeGeometryType('GEOMETRY[]')).toBe(false);
    expect(isDuckDbNativeGeometryType('STRUCT(g GEOMETRY)')).toBe(false);
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

  test('treats DESCRIBE output as the source of truth for geometry presence', () => {
    expect(
      describedColumnsIncludeGeometry([
        {name: 'Latitude', type: 'DOUBLE'},
        {name: 'Longitude', type: 'DOUBLE'},
        {name: 'Magnitude', type: 'DOUBLE'},
      ]),
    ).toBe(false);
    expect(
      describedColumnsIncludeGeometry([
        {name: 'geom', type: 'GEOMETRY'},
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ]),
    ).toBe(true);
    expect(
      describedColumnsIncludeGeometry([
        {name: 'shape', type: "GEOMETRY('EPSG:3857')"},
        {name: 'longitude', type: 'DOUBLE'},
      ]),
    ).toBe(true);
    expect(
      describedColumnsIncludeGeometry(
        [
          {name: 'Longitude', type: 'DOUBLE'},
          {name: 'Latitude', type: 'DOUBLE'},
        ],
        '__sqlrooms_geom',
      ),
    ).toBe(false);
    expect(
      describedColumnsIncludeGeometry([
        {name: '__sqlrooms_geom', type: 'BLOB'},
        {name: 'Longitude', type: 'DOUBLE'},
      ]),
    ).toBe(true);
  });
});
