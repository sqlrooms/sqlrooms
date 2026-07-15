import {describe, expect, test} from '@jest/globals';
import type {DeckMapConfig} from '../src/mapConfig';
import {
  assertDeckMapResourceConfig,
  getDeckMapResourceAiInstructions,
  getDeckMapResourceConfigIssues,
  mergeDeckMapResourceConfigPatch,
} from '../src/mapResourceAuthoring';

const validConfig: DeckMapConfig = {
  configMode: 'basic',
  datasets: {
    places: {
      source: {tableName: 'places'},
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
    },
  },
  spec: {
    layers: [
      {
        '@@type': 'GeoArrowScatterplotLayer',
        _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
      },
    ],
  },
  fitToData: {dataset: 'places', geometryColumn: 'geom'},
};

describe('Deck map resource authoring contract', () => {
  test('accepts a resource-native table-backed map', () => {
    expect(getDeckMapResourceConfigIssues(validConfig)).toEqual([]);
    expect(() => assertDeckMapResourceConfig(validConfig)).not.toThrow();
  });

  test('allows only a truly empty resource while waiting for user configuration', () => {
    const emptyConfig: DeckMapConfig = {spec: {layers: []}, datasets: {}};

    expect(
      getDeckMapResourceConfigIssues(emptyConfig, {allowEmpty: true}),
    ).toEqual([]);
    expect(getDeckMapResourceConfigIssues(emptyConfig)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({path: 'datasets'}),
        expect.objectContaining({path: 'spec.layers'}),
      ]),
    );
  });

  test('diagnoses the unsupported dataset and layer shape from a direct map create', () => {
    const invalidConfig = {
      configMode: 'custom',
      datasets: {
        coffee_shops: {
          geometryColumn: 'geom',
          sql: 'SELECT name, geom FROM coffee_shops_nyc',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoJsonLayer',
            data: '@@#coffee_shops',
          },
        ],
      },
      fitToData: {dataset: 'coffee_shops', geometryColumn: 'geom'},
    } as unknown as DeckMapConfig;

    expect(getDeckMapResourceConfigIssues(invalidConfig)).toEqual(
      expect.arrayContaining([
        {
          path: 'datasets.coffee_shops.source',
          message:
            'must define source.tableName or source.sqlQuery; top-level sql is not supported',
        },
        {
          path: 'spec.layers.0._sqlroomsBinding.dataset',
          message:
            'must bind the layer to a config.datasets entry; layer data references and implicit bindings are not durable resource bindings',
        },
      ]),
    );
  });

  test('merges sparse updates before validating the durable resource', () => {
    const next = mergeDeckMapResourceConfigPatch(validConfig, {
      datasets: {places: {geometryColumn: 'new_geom'}},
      spec: {layers: []},
      showLegends: false,
    });

    expect(next.datasets.places).toMatchObject({
      source: {tableName: 'places'},
      geometryColumn: 'new_geom',
    });
    expect(next.spec).toMatchObject({
      layers: (validConfig.spec as {layers: unknown[]}).layers,
    });
    expect(next.showLegends).toBe(false);
    expect(getDeckMapResourceConfigIssues(next)).toEqual([]);
  });

  test('replaces omitted layers only when explicitly requested', () => {
    const retainedLayer = {
      '@@type': 'GeoArrowScatterplotLayer',
      id: 'places',
      _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
    };
    const existingConfig: DeckMapConfig = {
      ...validConfig,
      spec: {
        layers: [
          retainedLayer,
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'stale-heatmap',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
          },
        ],
      },
    };
    const patch: DeckMapConfig = {
      spec: {layers: [retainedLayer]},
      datasets: {},
    };

    expect(
      (
        mergeDeckMapResourceConfigPatch(existingConfig, patch).spec as {
          layers: unknown[];
        }
      ).layers,
    ).toHaveLength(2);
    expect(
      (
        mergeDeckMapResourceConfigPatch(existingConfig, patch, {
          replaceLayers: true,
        }).spec as {layers: unknown[]}
      ).layers,
    ).toEqual([retainedLayer]);
  });

  test('replaces omitted datasets only when explicitly requested', () => {
    const existingConfig: DeckMapConfig = {
      ...validConfig,
      datasets: {
        ...validConfig.datasets,
        stale: {source: {tableName: 'missing_table'}},
      },
    };
    const patch: DeckMapConfig = {
      spec: {layers: []},
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'new_geom',
        },
      },
    };

    expect(
      Object.keys(
        mergeDeckMapResourceConfigPatch(existingConfig, patch).datasets,
      ),
    ).toEqual(['places', 'stale']);
    expect(
      mergeDeckMapResourceConfigPatch(existingConfig, patch, {
        replaceDatasets: true,
      }).datasets,
    ).toEqual({
      places: {
        source: {tableName: 'places'},
        geometryColumn: 'new_geom',
      },
    });
  });

  test('keeps the reusable instructions aligned with durable invariants', () => {
    const instructions = getDeckMapResourceAiInstructions();

    expect(instructions).toContain('source.tableName');
    expect(instructions).toContain('source.sqlQuery');
    expect(instructions).toContain('_sqlroomsBinding.dataset');
    expect(instructions).toContain('Never put sql directly');
    expect(instructions).toContain('Never use data: "@@#datasetId"');
    expect(instructions).not.toContain('Mosaic');
  });
});
