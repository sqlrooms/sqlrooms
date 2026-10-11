import {
  getFirstDatasetSourceTableName,
  hasSqlOnlyDatasetSource,
} from '../src/datasetSourceUtils';

describe('datasetSourceUtils', () => {
  it('returns undefined for empty datasets', () => {
    expect(getFirstDatasetSourceTableName({})).toBeUndefined();
    expect(getFirstDatasetSourceTableName({datasets: {}})).toBeUndefined();
    expect(hasSqlOnlyDatasetSource({})).toBe(false);
  });

  it('returns the first table-backed dataset source', () => {
    expect(
      getFirstDatasetSourceTableName({
        datasets: {
          a: {source: {sqlQuery: 'SELECT 1'}},
          b: {source: {tableName: 'places'}},
        },
      }),
    ).toBe('places');
  });

  it('detects SQL-only dataset sources', () => {
    expect(
      hasSqlOnlyDatasetSource({
        datasets: {
          a: {source: {sqlQuery: 'SELECT 1'}},
        },
      }),
    ).toBe(true);
    expect(
      hasSqlOnlyDatasetSource({
        datasets: {
          a: {source: {tableName: 'places', sqlQuery: 'SELECT 1'}},
        },
      }),
    ).toBe(false);
  });

  it('handles mixed datasets', () => {
    const config = {
      datasets: {
        sql: {source: {sqlQuery: 'SELECT 1'}},
        table: {source: {tableName: 'places'}},
      },
    };
    expect(getFirstDatasetSourceTableName(config)).toBe('places');
    expect(hasSqlOnlyDatasetSource(config)).toBe(true);
  });
});
