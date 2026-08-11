import {
  DECK_TABLE_DATASET_SOURCE_RELATION,
  createDeckTableDatasetSql,
} from '../src/datasets/tableDatasetSql';

describe('createDeckTableDatasetSql', () => {
  it('compiles direct table inputs with quoted table references', () => {
    expect(createDeckTableDatasetSql({tableName: 'main.events'})).toBe(
      'SELECT * FROM "main"."events"',
    );
    expect(createDeckTableDatasetSql({tableName: 'main."events.2026"'})).toBe(
      'SELECT * FROM "main"."events.2026"',
    );
  });

  it('wraps transform inputs with one SQLRooms-owned source CTE', () => {
    const sql = createDeckTableDatasetSql({
      tableName: 'events',
      transformSql: [
        'SELECT id',
        `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
        'WHERE id > 10;',
      ].join(' '),
    });

    expect(sql).toBe(
      [
        `WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`,
        '  SELECT * FROM "events"',
        ')',
        'SELECT *',
        'FROM (',
        `SELECT id FROM ${DECK_TABLE_DATASET_SOURCE_RELATION} WHERE id > 10`,
        ') AS "__sqlrooms_transform"',
      ].join('\n'),
    );
  });

  it('nests transform CTEs without merging authored SQL', () => {
    const sql = createDeckTableDatasetSql({
      tableName: 'events',
      transformSql: [
        'WITH nested AS (',
        `  SELECT id FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
        ')',
        `SELECT * FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
        'WHERE id IN (SELECT id FROM nested);',
      ].join(' '),
    });

    expect(sql).toContain(`WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`);
    expect(sql).toContain('SELECT * FROM "events"');
    expect(sql).toContain('FROM (\nWITH nested AS (');
    expect(sql).not.toContain(',\nnested AS (');
    expect(sql).toContain(
      `SELECT * FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    );
    expect(sql.trim().endsWith(';')).toBe(false);
  });

  it('preserves recursive transform CTEs inside the nested transform query', () => {
    const sql = createDeckTableDatasetSql({
      tableName: 'events',
      transformSql: [
        'WITH RECURSIVE nested AS (',
        `  SELECT * FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
        ')',
        'SELECT * FROM nested',
      ].join(' '),
    });

    expect(sql).toContain(`WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`);
    expect(sql).toContain('FROM (\nWITH RECURSIVE nested AS (');
    expect(sql).toContain(') AS "__sqlrooms_transform"');
  });

  it('rejects transform SQL that does not read from the source relation', () => {
    expect(() =>
      createDeckTableDatasetSql({
        tableName: 'events',
        transformSql: 'SELECT * FROM events',
      }),
    ).toThrow(
      `Deck table dataset transformSql must reference ${DECK_TABLE_DATASET_SOURCE_RELATION}.`,
    );
  });

  it('rewrites SELECT *, ST_AsWKB(geom) AS geom to EXCLUDE the colliding column', () => {
    const sql = createDeckTableDatasetSql({
      tableName: 'buildings',
      transformSql: `SELECT *, ST_AsWKB(geom) as geom FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    });
    expect(sql).toContain(
      `SELECT * EXCLUDE (geom), ST_AsWKB(geom) as geom FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    );
  });

  it('does not EXCLUDE a new ST_AsWKB alias that is not in the source table', () => {
    const sql = createDeckTableDatasetSql({
      tableName: 'earthquakes',
      transformSql: `SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    });
    expect(sql).toContain(
      `SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    );
    expect(sql).not.toContain('EXCLUDE (geom)');
  });

  it('does not strip geom from SELECT * FROM (… ST_AsWKB AS geom …) sample wrappers', () => {
    const inner = [
      'SELECT DateTime, Latitude, Longitude, Magnitude,',
      'ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom',
      `FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
      'WHERE Latitude IS NOT NULL',
    ].join(' ');
    const sql = createDeckTableDatasetSql({
      tableName: 'earthquakes',
      transformSql: `SELECT * FROM (${inner}) USING SAMPLE 100000 ROWS`,
    });
    expect(sql).toContain('ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom');
    expect(sql).not.toContain('EXCLUDE (geom)');
  });
});
