import {describe, expect, test} from '@jest/globals';
import type {DeckMapConfig} from '../src/mapConfig';
import {
  buildVisualFieldRangeSql,
  isConstantFieldSpan,
  rewriteConstantVisualFields,
  type VisualColumn,
} from '../src/visualFieldVariance';

function configWith(layer: Record<string, unknown>): DeckMapConfig {
  return {
    spec: {layers: [layer]},
    datasets: {
      sites: {source: {tableName: 'sites'}},
    },
  };
}

const columns: VisualColumn[] = [
  {name: 'status', type: 'VARCHAR'},
  {name: 'population', type: 'INTEGER'},
  {name: 'geom', type: 'GEOMETRY'},
  {name: 'id', type: 'INTEGER'},
];

describe('rewriteConstantVisualFields', () => {
  test('replaces a constant fill column with one that varies', () => {
    const next = rewriteConstantVisualFields(
      configWith({
        '@@type': 'GeoArrowH3HexagonLayer',
        _sqlroomsBinding: {dataset: 'sites'},
        getFillColor: {
          '@@function': 'colorScale',
          field: 'status',
          type: 'categorical',
          scheme: 'Tableau10',
        },
      }),
      new Map([['sites', columns]]),
      new Map([
        [
          'sites',
          new Map([
            ['status', {min: 'open', max: 'open'}],
            ['population', {min: 1, max: 40}],
          ]),
        ],
      ]),
    );
    const layer = (next.spec as {layers: Record<string, unknown>[]}).layers[0]!;
    expect(layer.getFillColor).toMatchObject({
      field: 'population',
      type: 'sequential',
      scheme: 'Viridis',
    });
  });

  test('uses a flat fill when every color column is constant', () => {
    const next = rewriteConstantVisualFields(
      configWith({
        '@@type': 'GeoArrowPolygonLayer',
        _sqlroomsBinding: {dataset: 'sites'},
        getFillColor: {
          '@@function': 'colorScale',
          field: 'status',
          type: 'categorical',
          scheme: 'Tableau10',
        },
      }),
      new Map([['sites', columns]]),
      new Map([['sites', new Map([['status', {min: 'open', max: 'open'}]])]]),
    );
    const layer = (next.spec as {layers: Record<string, unknown>[]}).layers[0]!;
    expect(layer.getFillColor).toEqual([56, 189, 248, 180]);
  });

  test('replaces a constant elevation column and ignores ids', () => {
    const next = rewriteConstantVisualFields(
      configWith({
        '@@type': 'GeoArrowColumnLayer',
        _sqlroomsBinding: {dataset: 'sites'},
        extruded: true,
        elevationScale: 100,
        getElevation: {
          '@@function': 'scale',
          field: 'status',
          type: 'linear',
          domain: 'auto',
          range: [0, 200],
        },
      }),
      new Map([['sites', columns]]),
      new Map([
        [
          'sites',
          new Map([
            ['status', {min: 'x', max: 'x'}],
            ['population', {min: 2, max: 9}],
            ['id', {min: 1, max: 50}],
          ]),
        ],
      ]),
    );
    const layer = (next.spec as {layers: Record<string, unknown>[]}).layers[0]!;
    expect(layer.getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'population',
      range: [0, 200],
    });
  });

  test('drops elevation when no numeric column varies', () => {
    const next = rewriteConstantVisualFields(
      configWith({
        '@@type': 'GeoArrowH3HexagonLayer',
        _sqlroomsBinding: {dataset: 'sites'},
        getElevation: '@@=status',
        elevationScale: 100,
      }),
      new Map([['sites', [{name: 'status', type: 'VARCHAR'}]]]),
      new Map([['sites', new Map([['status', {min: 'open', max: 'open'}]])]]),
    );
    const layer = (next.spec as {layers: Record<string, unknown>[]}).layers[0]!;
    expect(layer.getElevation).toBeUndefined();
    expect(layer.elevationScale).toBeUndefined();
  });

  test('keeps a field that varies', () => {
    const input = configWith({
      '@@type': 'GeoArrowH3HexagonLayer',
      _sqlroomsBinding: {dataset: 'sites'},
      getFillColor: {
        '@@function': 'colorScale',
        field: 'population',
        type: 'sequential',
        scheme: 'Viridis',
      },
    });
    const next = rewriteConstantVisualFields(
      input,
      new Map([['sites', columns]]),
      new Map([['sites', new Map([['population', {min: 1, max: 4}]])]]),
    );
    expect(next).toBe(input);
  });
});

describe('visual field helpers', () => {
  test('treats equal min and max as constant, including nulls', () => {
    expect(isConstantFieldSpan({min: 0, max: 0})).toBe(true);
    expect(isConstantFieldSpan({min: null, max: null})).toBe(true);
    expect(isConstantFieldSpan({min: 1, max: 2})).toBe(false);
    expect(isConstantFieldSpan(undefined)).toBe(false);
  });

  test('quotes column names in the range query', () => {
    expect(
      buildVisualFieldRangeSql('SELECT * FROM sites', ['pop', 'a"b']),
    ).toBe(
      'SELECT min("pop") AS "__vf0_min", max("pop") AS "__vf0_max", min("a""b") AS "__vf1_min", max("a""b") AS "__vf1_max" FROM (SELECT * FROM sites) AS "__sqlrooms_visual_fields"',
    );
  });
});
