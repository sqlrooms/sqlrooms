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
        'WITH nested AS (SELECT * FROM other_table)',
        `SELECT * FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
        'WHERE id IN (SELECT id FROM nested);',
      ].join(' '),
    });

    expect(sql).toContain(`WITH ${DECK_TABLE_DATASET_SOURCE_RELATION} AS (`);
    expect(sql).toContain('SELECT * FROM "events"');
    expect(sql).toContain('FROM other_table');
    expect(sql).toContain(
      `SELECT * FROM ${DECK_TABLE_DATASET_SOURCE_RELATION}`,
    );
    expect(
      sql.match(
        new RegExp(`WITH\\s+${DECK_TABLE_DATASET_SOURCE_RELATION}\\s+AS`, 'gi'),
      ),
    ).toHaveLength(1);
    expect(sql.trim().endsWith(';')).toBe(false);
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
});
