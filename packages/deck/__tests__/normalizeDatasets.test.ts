import {Table, vectorFromArray} from 'apache-arrow';
import {
  normalizeDatasets,
  resolveArrowTable,
} from '../src/datasets/normalizeDatasets';
import {isArrowTableDatasetInput, isSqlDatasetInput} from '../src/types';

describe('normalizeDatasets', () => {
  it('normalizes arrowTable dataset entries', () => {
    const table = new Table({
      value: vectorFromArray([1, 2, 3]),
    });

    const datasets = normalizeDatasets({
      default: {
        arrowTable: table,
        geometryColumn: 'geom',
      },
    });

    expect(datasets).toEqual({
      default: {
        arrowTable: table,
        geometryColumn: 'geom',
        geometryEncodingHint: undefined,
      },
    });
    expect(resolveArrowTable(datasets.default!)).toBe(table);
    expect(isArrowTableDatasetInput(datasets.default!)).toBe(true);
  });

  it('allows unresolved arrowTable dataset entries', () => {
    const datasets = normalizeDatasets({
      default: {
        arrowTable: undefined,
        geometryColumn: 'geom',
      },
    });

    expect(datasets).toEqual({
      default: {
        arrowTable: undefined,
        geometryColumn: 'geom',
        geometryEncodingHint: undefined,
      },
    });
    expect(resolveArrowTable(datasets.default!)).toBeUndefined();
    expect(isArrowTableDatasetInput(datasets.default!)).toBe(true);
  });

  it('normalizes sql dataset entries', () => {
    const datasets = normalizeDatasets({
      earthquakes: {
        sqlQuery: 'select 1',
      },
    });

    expect(isSqlDatasetInput(datasets.earthquakes!)).toBe(true);
  });

  it('rejects empty dataset registries', () => {
    expect(() => normalizeDatasets({})).toThrow(
      'DeckJsonMap requires at least one dataset entry.',
    );
  });
});
