import * as arrow from 'apache-arrow';
import {
  arrowTypeToDuckDbColumnType,
  createDeckMapDatasetOutputSchemaSql,
  isDeckMapGeneratedColumn,
  resolveDeckMapDatasetSchema,
} from '../src/useDeckMapDatasetSchema';
import {DECK_TABLE_DATASET_SOURCE_RELATION} from '../src/datasets/tableDatasetSql';

describe('Deck map dataset schema helpers', () => {
  it('wraps transformed table inputs as schema-only queries', () => {
    const sql = createDeckMapDatasetOutputSchemaSql({
      tableName: 'events',
      transformSql: [
        'SELECT *,',
        `ST_AsWKB(ST_Point(lon, lat)) AS __sqlrooms_geom`,
        `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
      ].join(' '),
    });

    expect(sql).toContain(`WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`);
    expect(sql).toContain('SELECT * FROM "events"');
    expect(sql).toContain('AS "__sqlrooms_schema_source"');
    expect(sql.endsWith('LIMIT 0')).toBe(true);
  });

  it('treats literal SQL sources as opaque output queries', () => {
    expect(
      createDeckMapDatasetOutputSchemaSql({
        sqlQuery: 'SELECT id, geom FROM pinned_map_source;',
      }),
    ).toBe(
      [
        'SELECT *',
        'FROM (SELECT id, geom FROM pinned_map_source) AS "__sqlrooms_schema_source"',
        'LIMIT 0',
      ].join('\n'),
    );
  });

  it('separates generated output columns from selectable data columns', () => {
    const schema = resolveDeckMapDatasetSchema({
      sourceColumns: [
        {name: 'lon', type: 'DOUBLE'},
        {name: 'lat', type: 'DOUBLE'},
      ],
      outputColumns: [
        {name: 'lon', type: 'DOUBLE'},
        {name: 'lat', type: 'DOUBLE'},
        {name: '__sqlrooms_geom', type: 'BLOB'},
        {name: 'timestamps', type: 'DOUBLE[]'},
      ],
      classifyGeneratedColumns: true,
    });

    expect(schema.sourceColumns.map((column) => column.name)).toEqual([
      'lon',
      'lat',
    ]);
    expect(schema.generatedOutputColumns.map((column) => column.name)).toEqual([
      '__sqlrooms_geom',
      'timestamps',
    ]);
    expect(schema.dataOutputColumns.map((column) => column.name)).toEqual([
      'lon',
      'lat',
    ]);
    expect(isDeckMapGeneratedColumn('source_geom')).toBe(true);
  });

  it('preserves source columns with generated-looking names as data columns', () => {
    const schema = resolveDeckMapDatasetSchema({
      sourceColumns: [
        {name: 'id', type: 'INTEGER'},
        {name: 'timestamps', type: 'DOUBLE'},
        {name: 'source_geom', type: 'VARCHAR'},
      ],
      outputColumns: [
        {name: 'id', type: 'INTEGER'},
        {name: 'timestamps', type: 'DOUBLE'},
        {name: 'source_geom', type: 'VARCHAR'},
        {name: '__sqlrooms_geom', type: 'BLOB'},
      ],
      classifyGeneratedColumns: true,
    });

    expect(schema.generatedOutputColumns.map((column) => column.name)).toEqual([
      '__sqlrooms_geom',
    ]);
    expect(schema.dataOutputColumns.map((column) => column.name)).toEqual([
      'id',
      'timestamps',
      'source_geom',
    ]);
  });

  it('preserves opaque SQL aliases with generated-looking names as data columns', () => {
    const schema = resolveDeckMapDatasetSchema({
      sourceColumns: [],
      outputColumns: [
        {name: 'id', type: 'INTEGER'},
        {name: 'timestamps', type: 'DOUBLE'},
        {name: 'source_geom', type: 'VARCHAR'},
      ],
      classifyGeneratedColumns: false,
    });

    expect(schema.generatedOutputColumns).toEqual([]);
    expect(schema.dataOutputColumns.map((column) => column.name)).toEqual([
      'id',
      'timestamps',
      'source_geom',
    ]);
  });

  it('falls back to source columns when output inspection fails', () => {
    const schema = resolveDeckMapDatasetSchema({
      sourceColumns: [
        {name: 'h3', type: 'VARCHAR'},
        {name: 'count_population', type: 'DOUBLE'},
      ],
      outputColumns: [],
      classifyGeneratedColumns: true,
      inspectionFailed: true,
    });

    expect(schema.outputColumns.map((column) => column.name)).toEqual([
      'h3',
      'count_population',
    ]);
    expect(schema.dataOutputColumns.map((column) => column.name)).toEqual([
      'h3',
      'count_population',
    ]);
    expect(schema.generatedOutputColumns).toEqual([]);
  });

  it('keeps inspected output columns when a failure reported some', () => {
    const schema = resolveDeckMapDatasetSchema({
      sourceColumns: [{name: 'lon', type: 'DOUBLE'}],
      outputColumns: [{name: '__sqlrooms_geom', type: 'BLOB'}],
      classifyGeneratedColumns: true,
      inspectionFailed: true,
    });

    expect(schema.outputColumns.map((column) => column.name)).toEqual([
      '__sqlrooms_geom',
    ]);
  });

  it('reports no output columns when inspection succeeded with none', () => {
    expect(
      resolveDeckMapDatasetSchema({
        sourceColumns: [{name: 'lon', type: 'DOUBLE'}],
        outputColumns: [],
      }).outputColumns,
    ).toEqual([]);
  });

  // A pinned-SQL dataset's output is the query's projection, so the hook
  // withholds the flag rather than offering unrelated table columns.
  it('withholds the source-column fallback when the caller opts out', () => {
    expect(
      resolveDeckMapDatasetSchema({
        sourceColumns: [{name: 'lon', type: 'DOUBLE'}],
        outputColumns: [],
        inspectionFailed: false,
      }).outputColumns,
    ).toEqual([]);
  });

  it('normalizes inspected Arrow schema types to selector-compatible types', () => {
    expect(arrowTypeToDuckDbColumnType(new arrow.Float64())).toBe('DOUBLE');
    expect(arrowTypeToDuckDbColumnType(new arrow.Float32())).toBe('DOUBLE');
    expect(arrowTypeToDuckDbColumnType(new arrow.Int32())).toBe('DOUBLE');
    expect(arrowTypeToDuckDbColumnType(new arrow.Uint16())).toBe('DOUBLE');
    expect(arrowTypeToDuckDbColumnType(new arrow.Utf8())).toBe('VARCHAR');
    expect(arrowTypeToDuckDbColumnType(new arrow.Binary())).toBe('BLOB');
    expect(arrowTypeToDuckDbColumnType(new arrow.Bool())).toBe('BOOLEAN');
    expect(arrowTypeToDuckDbColumnType(new arrow.DateDay())).toBe('TIMESTAMP');
    expect(arrowTypeToDuckDbColumnType(new arrow.TimestampSecond())).toBe(
      'TIMESTAMP',
    );
    expect(arrowTypeToDuckDbColumnType(new arrow.TimestampMillisecond())).toBe(
      'TIMESTAMP',
    );
    expect(arrowTypeToDuckDbColumnType(new arrow.TimestampMicrosecond())).toBe(
      'TIMESTAMP',
    );
    expect(arrowTypeToDuckDbColumnType(new arrow.TimestampNanosecond())).toBe(
      'TIMESTAMP',
    );
  });
});
