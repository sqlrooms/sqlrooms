import {Table, vectorFromArray} from 'apache-arrow';
import {normalizeDatasets, resolveArrowTable} from '../src/datasets/normalizeDatasets';

describe('normalizeDatasets', () => {
  it('normalizes single-dataset props to datasets.default', () => {
    const table = new Table({
      value: vectorFromArray([1, 2, 3]),
    });

    const datasets = normalizeDatasets({
      arrowTable: table,
      geometryColumn: 'geom',
    });

    expect(datasets).toEqual({
      default: {
        arrowTable: table,
        geometryColumn: 'geom',
        geometryEncodingHint: undefined,
        queryResult: undefined,
        sqlQuery: undefined,
      },
    });
    expect(resolveArrowTable(datasets.default!)).toBe(table);
  });

  it('rejects dataset entries that define multiple input sources', () => {
    const table = new Table({
      value: vectorFromArray([1]),
    });

    expect(() =>
      normalizeDatasets({
        datasets: {
          earthquakes: {
            sqlQuery: 'select 1',
            arrowTable: table,
          },
        },
      }),
    ).toThrow(
      'Dataset "earthquakes" must provide exactly one of sqlQuery, arrowTable, or queryResult.',
    );
  });

  it('rejects query results that do not expose an arrowTable', () => {
    expect(() =>
      normalizeDatasets({
        datasets: {
          earthquakes: {
            queryResult: {},
          },
        },
      }),
    ).toThrow('Dataset "earthquakes" queryResult did not expose an arrowTable.');
  });
});
