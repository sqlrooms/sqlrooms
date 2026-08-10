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

  test('accepts H3 layers that bind hexagonColumn without getHexagon', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            id: 'hex',
            _sqlroomsBinding: {dataset: 'hexes', hexagonColumn: 'h3'},
          },
        ],
      },
      datasets: {
        hexes: {source: {tableName: 'hexes'}},
      },
    });
    expect(issues).toEqual([]);
  });

  test('rejects H3 layers missing both getHexagon and hexagonColumn', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            id: 'hex',
            _sqlroomsBinding: {dataset: 'hexes'},
          },
        ],
      },
      datasets: {
        hexes: {source: {tableName: 'hexes'}},
      },
    });
    expect(
      issues.some(
        (i) =>
          i.path === 'spec.layers.0.getHexagon' &&
          i.message.includes('hexagonColumn'),
      ),
    ).toBe(true);
  });

  test('rejects object getHexagon on H3 layers', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            id: 'hex',
            getHexagon: {'@@function': 'columnAccessor', column: 'h3'},
            _sqlroomsBinding: {dataset: 'hexes'},
          },
        ],
      },
      datasets: {
        hexes: {source: {tableName: 'hexes'}},
      },
    });
    expect(
      issues.some(
        (i) =>
          i.path === 'spec.layers.0.getHexagon' &&
          i.message.includes('"@@=h3_column_name"'),
      ),
    ).toBe(true);
  });

  test('rejects heatmap colorRange and object getWeight', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'heat',
            colorRange: [[255, 0, 0]],
            getWeight: {'@@function': 'getNumericColumn', field: 'Magnitude'},
            _sqlroomsBinding: {dataset: 'points'},
          },
        ],
      },
      datasets: {
        points: {
          source: {tableName: 'points'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });
    expect(
      issues.some(
        (i) =>
          i.path === 'spec.layers.0.colorRange' &&
          i.message.includes('omit colorRange'),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.path === 'spec.layers.0.getWeight' &&
          i.message.includes('"@@=ColumnName"'),
      ),
    ).toBe(true);
  });

  test('rejects arc getSourcePosition/getTargetPosition accessors', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowArcLayer',
            id: 'arcs',
            getSourcePosition: '@@=source_geom',
            getTargetPosition: '@@=target_geom',
            _sqlroomsBinding: {
              dataset: 'arcs',
              sourceGeometryColumn: 'source_geom',
              targetGeometryColumn: 'target_geom',
            },
          },
        ],
      },
      datasets: {
        arcs: {
          source: {tableName: 'od'},
          geometryEncodingHint: 'wkb',
        },
      },
    });
    expect(
      issues.some(
        (i) =>
          i.path === 'spec.layers.0.getSourcePosition' &&
          i.message.includes('sourceGeometryColumn'),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.path === 'spec.layers.0.getTargetPosition' &&
          i.message.includes('targetGeometryColumn'),
      ),
    ).toBe(true);
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

  test('preserves sqlQuery when a sparse patch sends a bare tableName source', () => {
    const existingConfig: DeckMapConfig = {
      ...validConfig,
      datasets: {
        places: {
          source: {
            sqlQuery:
              'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM places',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    };

    const next = mergeDeckMapResourceConfigPatch(existingConfig, {
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
        },
      },
      spec: {layers: []},
    });

    expect(next.datasets.places.source).toEqual({
      sqlQuery: 'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM places',
    });
  });

  test('preserves transformSql when a sparse patch sends a bare tableName source', () => {
    const transformSql =
      'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source';
    const existingConfig: DeckMapConfig = {
      ...validConfig,
      datasets: {
        places: {
          source: {
            tableName: 'places',
            transformSql,
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    };

    const next = mergeDeckMapResourceConfigPatch(existingConfig, {
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'places',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: [255, 0, 0, 180],
          },
        ],
      },
    });

    expect(next.datasets.places.source).toEqual({
      tableName: 'places',
      transformSql,
    });
    expect(next.datasets.places.geometryColumn).toBe('geom');
  });

  test('allows an intentional transformSql update when the patch includes it', () => {
    const existingConfig: DeckMapConfig = {
      ...validConfig,
      datasets: {
        places: {
          source: {
            tableName: 'places',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
        },
      },
    };
    const nextTransformSql =
      'SELECT id, ST_AsWKB(ST_Point(x, y)) AS geom FROM __sqlrooms_source';

    const next = mergeDeckMapResourceConfigPatch(existingConfig, {
      datasets: {
        places: {
          source: {
            tableName: 'places',
            transformSql: nextTransformSql,
          },
        },
      },
      spec: {layers: []},
    });

    expect(next.datasets.places.source).toEqual({
      tableName: 'places',
      transformSql: nextTransformSql,
    });
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

  test('rejects TripsLayer LIST aggregation without GROUP BY', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowTripsLayer',
            id: 'trips',
            _sqlroomsBinding: {
              dataset: 'trips',
              geometryColumn: 'geom',
              timestampColumn: 'timestamps',
            },
          },
        ],
      },
      datasets: {
        trips: {
          source: {
            tableName: 'nyc_trips',
            transformSql:
              'SELECT ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY t))) AS geom, LIST(t ORDER BY t) AS timestamps FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues.some((i) => i.message.includes('GROUP BY'))).toBe(true);
  });

  test('rejects TripsLayer ST_MakeLine(... ORDER BY) without LIST', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowTripsLayer',
            id: 'trips',
            _sqlroomsBinding: {
              dataset: 'trips',
              geometryColumn: 'geom',
              timestampColumn: 'timestamps',
            },
          },
        ],
      },
      datasets: {
        trips: {
          source: {
            tableName: 'nyc_trips_animated',
            transformSql:
              'SELECT path_id, ST_AsWKB(ST_MakeLine(ST_Point(lon, lat) ORDER BY waypoint_order)) AS geom, LIST(timestamp ORDER BY waypoint_order) AS timestamps FROM __sqlrooms_source GROUP BY path_id',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues.some((i) => i.message.includes('ST_MakeLine(LIST'))).toBe(
      true,
    );
  });

  test('accepts TripsLayer LIST aggregation with GROUP BY trip id', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowTripsLayer',
            id: 'trips',
            _sqlroomsBinding: {
              dataset: 'trips',
              geometryColumn: 'geom',
              timestampColumn: 'timestamps',
            },
          },
        ],
      },
      datasets: {
        trips: {
          source: {
            tableName: 'nyc_trips',
            transformSql:
              'SELECT trip_id, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY t))) AS geom, LIST(t ORDER BY t) AS timestamps FROM __sqlrooms_source GROUP BY trip_id',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual([]);
  });

  test('rejects bare ST_Point(...) AS col without ST_AsWKB', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowArcLayer',
            id: 'arcs',
            _sqlroomsBinding: {
              dataset: 'arcs',
              sourceGeometryColumn: 'source_geom',
              targetGeometryColumn: 'target_geom',
            },
          },
        ],
      },
      datasets: {
        arcs: {
          source: {
            tableName: 'od',
            transformSql:
              'SELECT *, ST_Point(source_lon, source_lat) AS source_geom, ST_Point(target_lon, target_lat) AS target_geom FROM __sqlrooms_source',
          },
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(
      issues.some(
        (i) =>
          i.path === 'datasets.arcs.source' &&
          i.message.includes('ST_AsWKB(ST_Point'),
      ),
    ).toBe(true);
  });

  test('rejects bare ST_Point with nested args as a geometry alias', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      datasets: {
        places: {
          source: {
            tableName: 'places',
            transformSql:
              'SELECT *, ST_Point(h3_cell_to_lng(h), h3_cell_to_lat(h)) AS geom FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(
      issues.some(
        (i) =>
          i.path === 'datasets.places.source' &&
          i.message.includes('ST_AsWKB(ST_Point'),
      ),
    ).toBe(true);
  });

  test('accepts ST_AsWKB(ST_Point(...)) AS col', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowArcLayer',
            id: 'arcs',
            _sqlroomsBinding: {
              dataset: 'arcs',
              sourceGeometryColumn: 'source_geom',
              targetGeometryColumn: 'target_geom',
            },
          },
        ],
      },
      datasets: {
        arcs: {
          source: {
            tableName: 'od',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(source_lon, source_lat)) AS source_geom, ST_AsWKB(ST_Point(target_lon, target_lat)) AS target_geom FROM __sqlrooms_source',
          },
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual([]);
  });

  test('does not flag ST_Point used only inside ST_MakeLine(LIST(...))', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowTripsLayer',
            id: 'trips',
            _sqlroomsBinding: {
              dataset: 'trips',
              geometryColumn: 'geom',
              timestampColumn: 'timestamps',
            },
          },
        ],
      },
      datasets: {
        trips: {
          source: {
            tableName: 'nyc_trips',
            transformSql:
              'SELECT trip_id, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY t))) AS geom, LIST(t ORDER BY t) AS timestamps FROM __sqlrooms_source GROUP BY trip_id',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual([]);
  });

  test('rejects unprefixed layer class names with the GeoArrow replacement', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'ScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.@@type',
          message: expect.stringContaining('GeoArrowScatterplotLayer'),
        }),
      ]),
    );
  });

  test('rejects ColorScale @@type/column color accessor syntax', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@type': 'ColorScale',
              column: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
            },
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringContaining('@@function'),
        }),
      ]),
    );
  });

  test('rejects colorScale that uses column instead of field', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              column: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringContaining('field'),
        }),
      ]),
    );
  });
});
