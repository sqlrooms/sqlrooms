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

  test('rejects bare getHexagon column names without @@= or hexagonColumn', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            id: 'hex',
            _sqlroomsBinding: {dataset: 'hexes'},
            getHexagon: 'hex_id',
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
          i.path === 'spec.layers.0.getHexagon' && i.message.includes('@@='),
      ),
    ).toBe(true);
  });

  test('rejects H3 getHexagon expressions that are not simple column accessors', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            id: 'hex',
            _sqlroomsBinding: {dataset: 'hexes'},
            getHexagon: "@@=h3 + ''",
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
          i.message.includes('simple column accessor'),
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

  test('rejects getWeight on heatmap layers in basic mode (default density only)', () => {
    const objectIssues = getDeckMapResourceConfigIssues({
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
      objectIssues.some((i) => i.path === 'spec.layers.0.colorRange'),
    ).toBe(false);
    expect(
      objectIssues.some(
        (i) =>
          i.path === 'spec.layers.0.getWeight' &&
          i.message.includes('omit getWeight'),
      ),
    ).toBe(true);

    const columnIssues = getDeckMapResourceConfigIssues({
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'heat',
            getWeight: '@@=height',
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
      columnIssues.some(
        (i) =>
          i.path === 'spec.layers.0.getWeight' &&
          i.message.includes('omit getWeight'),
      ),
    ).toBe(true);
  });

  test('rejects column getWeight on heatmap layers in custom mode', () => {
    const issues = getDeckMapResourceConfigIssues({
      configMode: 'custom',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'heat',
            getWeight: '@@=height',
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
          i.path === 'spec.layers.0.getWeight' &&
          i.message.includes('omit getWeight'),
      ),
    ).toBe(true);
  });

  test('allows numeric getWeight on heatmap layers in custom mode', () => {
    const issues = getDeckMapResourceConfigIssues({
      configMode: 'custom',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'heat',
            getWeight: 1,
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
    expect(issues.some((i) => i.path === 'spec.layers.0.getWeight')).toBe(
      false,
    );
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

  test('rejects basic-mode string getRadius on scatterplot', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getRadius: 'Magnitude * 500',
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getRadius',
          message: expect.stringContaining('positive number'),
        }),
      ]),
    );
  });

  test('rejects basic-mode object getRadius scale accessors', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getRadius: {
              '@@function': 'scaleLinear',
              field: 'Magnitude',
              domain: 'auto',
              range: [2, 20],
            },
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getRadius',
          message: expect.stringContaining('positive number'),
        }),
      ]),
    );
  });

  test('rejects basic-mode string getWidth on path layers', () => {
    const issues = getDeckMapResourceConfigIssues({
      configMode: 'basic',
      datasets: {
        routes: {
          source: {tableName: 'routes'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPathLayer',
            _sqlroomsBinding: {dataset: 'routes', geometryColumn: 'geom'},
            getWidth: 'flow * 10',
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getWidth',
          message: expect.stringContaining('widthUnits'),
        }),
      ]),
    );
  });

  test('rejects basic-mode string radiusPixels on heatmap', () => {
    const issues = getDeckMapResourceConfigIssues({
      configMode: 'basic',
      datasets: {
        points: {
          source: {tableName: 'points'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'points'},
            radiusPixels: 'density * 10',
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.radiusPixels',
          message: expect.stringContaining('positive number'),
        }),
      ]),
    );
  });

  test('rejects basic-mode string column radius and getElevation', () => {
    const issues = getDeckMapResourceConfigIssues({
      configMode: 'basic',
      datasets: {
        points: {
          source: {tableName: 'points'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'points'},
            radius: 'count * 5',
            getElevation: 'floors * 3',
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.radius',
          message: expect.stringContaining('positive number'),
        }),
        expect.objectContaining({
          path: 'spec.layers.0.getElevation',
          message: expect.stringContaining('@@=columnName'),
        }),
      ]),
    );
  });

  test('rejects basic-mode free-form getElevation expressions on polygon layers', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getElevation: 'floors * 3',
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getElevation',
          message: expect.stringContaining('@@=columnName'),
        }),
      ]),
    );
  });

  test('allows basic-mode getElevation column accessor @@=height', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getElevation: '@@=height',
            extruded: true,
            radius: 50,
          },
        ],
      },
    });
    expect(issues.some((i) => i.path === 'spec.layers.0.getElevation')).toBe(
      false,
    );
  });

  test('rejects basic-mode elevation scale objects without a field', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getElevation: {
              '@@function': 'scale',
              type: 'linear',
              domain: 'auto',
              range: [0, 200],
            },
            extruded: true,
            radius: 50,
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getElevation',
          message: expect.stringContaining('@@function'),
        }),
      ]),
    );
  });

  test('allows basic-mode elevation scale objects with a field', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'basic',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getElevation: {
              '@@function': 'scale',
              field: 'height',
              type: 'linear',
              domain: 'auto',
              range: [0, 200],
            },
            extruded: true,
            radius: 50,
          },
        ],
      },
    });
    expect(issues.some((i) => i.path === 'spec.layers.0.getElevation')).toBe(
      false,
    );
  });

  test('allows string size/elevation accessors in custom mode', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      configMode: 'custom',
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getRadius: '@@=radius_col',
          },
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getElevation: '@@=height',
          },
        ],
      },
    });
    expect(issues.some((i) => i.path === 'spec.layers.0.getRadius')).toBe(
      false,
    );
    expect(issues.some((i) => i.path === 'spec.layers.1.getElevation')).toBe(
      false,
    );
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
    expect(instructions).toContain('Never set mapStyle to a mapbox://');
    expect(instructions).toContain('omit getWeight');
    expect(instructions).toContain('will not invent centroids');
    expect(instructions).toContain('SELECT *, ST_AsWKB(col) AS col');
    expect(instructions).toContain('COLOR SCALE FIELD VARIANCE');
    expect(instructions).toContain('min = max');
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

  test('rejects PathLayer LIST aggregation without GROUP BY', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPathLayer',
            id: 'routes',
            _sqlroomsBinding: {
              dataset: 'routes',
              geometryColumn: 'geom',
            },
          },
        ],
      },
      datasets: {
        routes: {
          source: {
            tableName: 'waypoints',
            transformSql:
              'SELECT ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY t))) AS geom FROM __sqlrooms_source',
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

  test('rejects nested ST_MakeLine(ST_Point(...) ORDER BY) forms', () => {
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
            tableName: 'trips',
            transformSql:
              'SELECT id, ST_AsWKB(ST_MakeLine(ST_Point(h3_cell_to_lng(h), h3_cell_to_lat(h)) ORDER BY t)) AS geom, LIST(t ORDER BY t) AS timestamps FROM __sqlrooms_source GROUP BY id',
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

  test('rejects SELECT *, ST_AsWKB(geom) AS geom collisions', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'buildings',
            _sqlroomsBinding: {dataset: 'buildings', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        buildings: {
          source: {
            tableName: 'buildings',
            transformSql:
              'SELECT *, ST_AsWKB(geom) AS geom FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(
      issues.some(
        (i) =>
          i.path === 'datasets.buildings.source' &&
          i.message.includes('SELECT * EXCLUDE'),
      ),
    ).toBe(true);
  });

  test('rejects SELECT *, ST_AsWKB(Geom) AS geom case-only collisions', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'buildings',
            _sqlroomsBinding: {dataset: 'buildings', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        buildings: {
          source: {
            tableName: 'buildings',
            transformSql:
              'SELECT *, ST_AsWKB(Geom) AS geom FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(
      issues.some(
        (i) =>
          i.path === 'datasets.buildings.source' &&
          i.message.includes('SELECT * EXCLUDE'),
      ),
    ).toBe(true);
  });

  test('rejects SELECT s.*, ST_AsWKB(s.geom) AS geom qualified-star collisions', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'buildings',
            _sqlroomsBinding: {dataset: 'buildings', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        buildings: {
          source: {
            tableName: 'buildings',
            transformSql:
              'SELECT s.*, ST_AsWKB(s.geom) AS geom FROM __sqlrooms_source s',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(
      issues.some(
        (i) =>
          i.path === 'datasets.buildings.source' &&
          i.message.includes('SELECT * EXCLUDE'),
      ),
    ).toBe(true);
  });

  test('accepts SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geom', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            id: 'buildings',
            _sqlroomsBinding: {dataset: 'buildings', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        buildings: {
          source: {
            tableName: 'buildings',
            transformSql:
              'SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geom FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual([]);
  });

  test('accepts SELECT *, ST_AsWKB(ST_Point(...)) AS geom (new alias)', () => {
    const issues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {dataset: 'points', geometryColumn: 'geom'},
          },
        ],
      },
      datasets: {
        points: {
          source: {
            tableName: 'earthquakes',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source',
          },
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    });

    expect(issues).toEqual([]);
  });

  test('allows bare ST_Point(...) AS col (pipeline wraps native GEOMETRY as WKB)', () => {
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

    expect(issues.some((i) => i.message.includes('ST_AsWKB(ST_Point'))).toBe(
      false,
    );
  });

  test('allows bare ST_Point with nested args as a geometry alias', () => {
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

    expect(issues.some((i) => i.message.includes('ST_AsWKB(ST_Point'))).toBe(
      false,
    );
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
    const scatterIssues = getDeckMapResourceConfigIssues({
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
    expect(scatterIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.@@type',
          message: expect.stringContaining('GeoArrowScatterplotLayer'),
        }),
      ]),
    );

    const heatIssues = getDeckMapResourceConfigIssues({
      spec: {
        layers: [
          {
            '@@type': 'HeatmapLayer',
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
    expect(heatIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.@@type',
          message: expect.stringContaining('GeoArrowHeatmapLayer'),
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

  test('rejects bare ColorScale @@type without field/column', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {'@@type': 'ColorScale'},
          },
        ],
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

  test('rejects quantile + Viridis (continuous scheme needs sequential)', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'quantile',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringMatching(/Viridis.*sequential/i),
        }),
      ]),
    );
  });

  test('accepts quantile + YlOrRd', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'quantile',
              scheme: 'YlOrRd',
              domain: 'auto',
            },
          },
        ],
      },
    });

    expect(issues).toEqual([]);
  });

  test('accepts sequential + Viridis', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
    });

    expect(issues).toEqual([]);
  });

  test('rejects sequential + Tableau10', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'category',
              type: 'sequential',
              scheme: 'Tableau10',
              domain: 'auto',
            },
          },
        ],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringMatching(/Tableau10.*categorical/i),
        }),
      ]),
    );
  });

  test('rejects colorScale missing scheme', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'magnitude',
              type: 'sequential',
              domain: 'auto',
            },
          },
        ],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringMatching(/requires a "scheme"/i),
        }),
      ]),
    );
  });

  test('rejects mapbox:// mapStyle URLs', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'mapStyle',
          message: expect.stringContaining('mapbox://'),
        }),
      ]),
    );
  });

  test('rejects threshold color scales without thresholds', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'value',
              type: 'threshold',
              scheme: 'YlOrRd',
              domain: 'auto',
            },
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringMatching(/thresholds/i),
        }),
      ]),
    );
  });

  test('rejects colorScale type/scheme with surrounding whitespace', () => {
    const issues = getDeckMapResourceConfigIssues({
      ...validConfig,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'places', geometryColumn: 'geom'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'value',
              type: ' sequential ',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'spec.layers.0.getFillColor',
          message: expect.stringMatching(/whitespace/i),
        }),
      ]),
    );
  });
});
