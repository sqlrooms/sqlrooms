import {describe, expect, test} from '@jest/globals';
import {
  normalizeAiDeckMapConfig,
  validateAndFixColorScaleFields,
} from '../src/aiNormalize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(layers: unknown[], datasets: Record<string, unknown> = {}) {
  return {spec: {layers}, datasets} as any;
}

function makeBasicConfig(
  layers: unknown[],
  datasets: Record<string, unknown> = {},
) {
  return {configMode: 'basic' as const, spec: {layers}, datasets};
}

/** Typed accessor so tests can read layer props without TS errors. */
function getLayer(result: any, index = 0): Record<string, any> {
  return result.spec.layers[index] as Record<string, any>;
}

// ---------------------------------------------------------------------------
// Hidden layers — do not delete visible:false (legitimate hide state)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — hidden layers', () => {
  test('keeps layers with visible:false (legitimate user/AI hide state)', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'pts',
            _sqlroomsBinding: {dataset: 'ds'},
            visible: false,
          },
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'heat',
            _sqlroomsBinding: {dataset: 'ds'},
            visible: true,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(result.spec.layers).toHaveLength(2);
    expect(getLayer(result, 0).visible).toBe(false);
    expect(getLayer(result, 1)['@@type']).toBe('GeoArrowHeatmapLayer');
  });
});

// ---------------------------------------------------------------------------
// Color accessor syntax — normalize only fixes scheme casing
// (invalid ColorScale shapes are rejected in mapResourceAuthoring.test.ts)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — colorScale scheme casing', () => {
  test('fixes lowercase scheme name to correct casing (e.g. "blues" → "Blues")', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'Magnitude',
              type: 'sequential',
              scheme: 'blues',
              domain: 'auto',
            },
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor.scheme).toBe('Blues');
  });

  test('fixes mixed-case scheme name (e.g. "VIRIDIS" → "Viridis")', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'value',
              type: 'sequential',
              scheme: 'VIRIDIS',
              domain: 'auto',
            },
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor.scheme).toBe('Viridis');
  });

  test('leaves unknown scheme names unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'value',
              type: 'sequential',
              scheme: 'CustomScheme',
              domain: 'auto',
            },
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor.scheme).toBe('CustomScheme');
  });

  test('fixes scheme casing on non-fill color props (getColor)', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowPathLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getColor: {
              '@@function': 'colorScale',
              field: 'speed',
              type: 'sequential',
              scheme: 'reds',
              domain: 'auto',
            },
            getWidth: 2,
            widthUnits: 'pixels',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getColor.scheme).toBe('Reds');
  });
});

// ---------------------------------------------------------------------------
// Default getFillColor injection
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — default getFillColor', () => {
  test.each([
    'GeoArrowScatterplotLayer',
    'GeoArrowPolygonLayer',
    'GeoArrowSolidPolygonLayer',
  ])(
    'injects default sky-blue fill for %s when getFillColor is absent',
    (type) => {
      const result = normalizeAiDeckMapConfig(
        makeConfig([{'@@type': type, _sqlroomsBinding: {dataset: 'ds'}}], {
          ds: {source: {tableName: 'ds'}},
        }),
      );
      expect(getLayer(result).getFillColor).toEqual([56, 189, 248, 180]);
    },
  );

  test('does not overwrite an existing getFillColor array', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: [255, 0, 0, 255],
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor).toEqual([255, 0, 0, 255]);
  });

  test('does not overwrite a colorScale getFillColor', () => {
    const colorScale = {
      '@@function': 'colorScale',
      field: 'mag',
      type: 'sequential',
      scheme: 'Viridis',
      domain: 'auto',
    };
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: colorScale,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor).toEqual(colorScale);
  });
});

// ---------------------------------------------------------------------------
// filled: false with no stroke
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — filled:false guard', () => {
  test('resets filled to true when stroked is absent', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            filled: false,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).filled).toBe(true);
  });

  test('resets filled to true when stroked is false', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            filled: false,
            stroked: false,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).filled).toBe(true);
  });

  test('leaves filled:false alone when stroked:true (intentional outline)', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            filled: false,
            stroked: true,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).filled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Heatmap colorRange — AI strip only (UI may set colorRange later; not validated)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — heatmap colorRange', () => {
  test('strips colorRange from GeoArrowHeatmapLayer', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            colorRange: [
              [255, 0, 0],
              [0, 255, 0],
            ],
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).colorRange).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// H3 getHexagon string lift (still normalize)
// ---------------------------------------------------------------------------
describe('normalizeAiDeckMapConfig — H3 getHexagon', () => {
  test('lifts @@= getHexagon into hexagonColumn and injects fitToData', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'h3_data'},
            getHexagon: '@@=hex_id',
          },
        ],
        {h3_data: {source: {tableName: 'h3_pentagon'}}},
      ),
    );
    expect(getLayer(result).getHexagon).toBe('@@=hex_id');
    expect(getLayer(result)._sqlroomsBinding).toEqual({
      dataset: 'h3_data',
      hexagonColumn: 'hex_id',
    });
    expect(result.fitToData).toEqual({dataset: 'h3_data'});
  });

  test('does not overwrite an existing hexagonColumn', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'ds', hexagonColumn: 'existing'},
            getHexagon: '@@=hex_id',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result)._sqlroomsBinding.hexagonColumn).toBe('existing');
  });

  test('does not lift expression getHexagon into hexagonColumn', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'h3_data'},
            getHexagon: "@@=h3 + ''",
          },
        ],
        {h3_data: {source: {tableName: 'h3_pentagon'}}},
      ),
    );
    expect(getLayer(result)._sqlroomsBinding).toEqual({dataset: 'h3_data'});
  });
});
// getRadius — zero/negative clamping (basic mode only)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — getRadius', () => {
  test('clamps getRadius:0 to default', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: 0,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getRadius).toBe(4);
    expect(getLayer(result).radiusUnits).toBe('pixels');
    expect(getLayer(result).radiusMinPixels).toBe(4);
    expect(getLayer(result).radiusMaxPixels).toBe(4);
  });

  test('clamps negative getRadius to default', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: -5,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getRadius).toBe(4);
    expect(getLayer(result).radiusUnits).toBe('pixels');
  });

  test('leaves positive getRadius unchanged in basic mode', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: 6,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getRadius).toBe(6);
  });

  test('skips radius clamps entirely in custom mode (including zero)', () => {
    const result = normalizeAiDeckMapConfig({
      configMode: 'custom' as const,
      ...makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: 0,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    });
    expect(getLayer(result).getRadius).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getWidth — widthUnits + inverted clamps (basic mode)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — getWidth', () => {
  test('injects widthUnits:pixels when getWidth is numeric but widthUnits is absent', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowPathLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWidth: 3,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).widthUnits).toBe('pixels');
    expect(getLayer(result).getWidth).toBe(3);
  });

  test('forces widthUnits to pixels even when meters was set', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowPathLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWidth: 100,
            widthUnits: 'meters',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).widthUnits).toBe('pixels');
  });

  test('fixes inverted width clamps even when widthUnits was also wrong', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowPathLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWidth: 5,
            widthUnits: 'meters',
            widthMinPixels: 20,
            widthMaxPixels: 10,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    const layer = getLayer(result);
    expect(layer.widthUnits).toBe('pixels');
    expect(layer.widthMinPixels).toBe(20);
    expect(layer.widthMaxPixels).toBe(20);
    expect(layer.getWidth).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// heatmap radiusPixels clamping
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — heatmap radiusPixels', () => {
  test('clamps radiusPixels:0 to default', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radiusPixels: 0,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radiusPixels).toBe(30);
  });

  test('leaves positive radiusPixels unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radiusPixels: 50,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radiusPixels).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// column layer radius clamping
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — column radius', () => {
  test('clamps radius:0 to default meters', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radius: 0,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radius).toBe(20);
  });

  test('leaves positive radius unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radius: 100,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radius).toBe(100);
  });

  test('sets extruded when getElevation is present', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radius: 15,
            getElevation: '@@=height',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    const layer = getLayer(result);
    expect(layer.radius).toBe(15);
    expect(layer.extruded).toBe(true);
  });

  test('strips radiusUnits:pixels and point radius leftovers', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radius: 296,
            radiusUnits: 'pixels',
            getRadius: 5,
            radiusMinPixels: 5,
            radiusMaxPixels: 45,
            radiusPixels: 63,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    const layer = getLayer(result);
    expect(layer.radius).toBe(296);
    expect(layer.radiusUnits).toBe('meters');
    expect(layer.getRadius).toBeUndefined();
    expect(layer.radiusMinPixels).toBeUndefined();
    expect(layer.radiusMaxPixels).toBeUndefined();
    expect(layer.radiusPixels).toBeUndefined();
  });

  test('defaults radius when stripping point leftovers without radius', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: 5,
            radiusMinPixels: 5,
            radiusMaxPixels: 45,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    const layer = getLayer(result);
    expect(layer.radius).toBe(20);
    expect(layer.radiusUnits).toBe('meters');
    expect(layer.getRadius).toBeUndefined();
    expect(layer.radiusMinPixels).toBeUndefined();
    expect(layer.radiusMaxPixels).toBeUndefined();
  });

  test('defaults missing radius on column layer', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radius).toBe(20);
    expect(getLayer(result).radiusUnits).toBe('meters');
  });
});

// ---------------------------------------------------------------------------
// _sqlroomsBinding.dataset auto-injection and typo repair
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — _sqlroomsBinding.dataset', () => {
  test('injects dataset binding when _sqlroomsBinding is absent and one dataset exists', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([{'@@type': 'GeoArrowScatterplotLayer'}], {
        earthquakes: {source: {tableName: 'earthquakes'}},
      }),
    );
    expect(getLayer(result)._sqlroomsBinding?.dataset).toBe('earthquakes');
  });

  test('injects dataset binding when _sqlroomsBinding exists but dataset key is missing', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {geometryColumn: 'geom'},
          },
        ],
        {earthquakes: {source: {tableName: 'earthquakes'}}},
      ),
    );
    expect(getLayer(result)._sqlroomsBinding.dataset).toBe('earthquakes');
    expect(getLayer(result)._sqlroomsBinding.geometryColumn).toBe('geom');
  });

  test('replaces a wrong dataset ID when only one dataset exists', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'earthquaqes'},
          },
        ],
        {earthquakes: {source: {tableName: 'earthquakes'}}},
      ),
    );
    expect(getLayer(result)._sqlroomsBinding.dataset).toBe('earthquakes');
  });

  test('does not alter a correct dataset binding', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'earthquakes'},
          },
        ],
        {earthquakes: {source: {tableName: 'earthquakes'}}},
      ),
    );
    expect(getLayer(result)._sqlroomsBinding.dataset).toBe('earthquakes');
  });

  test('does not auto-inject when multiple datasets exist (ambiguous)', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([{'@@type': 'GeoArrowScatterplotLayer'}], {
        ds1: {source: {tableName: 'table1'}},
        ds2: {source: {tableName: 'table2'}},
      }),
    );
    expect(getLayer(result)._sqlroomsBinding).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Catalog prefix stripping
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — catalog prefix in tableName', () => {
  const stripCliCatalog = {stripCatalogNames: ['sqlrooms-cli'] as const};

  test('strips configured workspace catalog from three-part unquoted identifier', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {source: {tableName: 'sqlrooms-cli.main.earthquakes'}},
      }),
      stripCliCatalog,
    );
    expect(result.datasets.ds.source.tableName).toBe('main.earthquakes');
  });

  test('strips configured workspace catalog from three-part quoted identifier', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {source: {tableName: '"sqlrooms-cli"."main"."earthquakes"'}},
      }),
      stripCliCatalog,
    );
    expect(result.datasets.ds.source.tableName).toBe('"main"."earthquakes"');
  });

  test('does not strip catalogs unless stripCatalogNames is provided', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {source: {tableName: 'sqlrooms-cli.main.earthquakes'}},
      }),
    );
    expect(result.datasets.ds.source.tableName).toBe(
      'sqlrooms-cli.main.earthquakes',
    );
  });

  test('preserves attached/remote catalog-qualified table sources', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {source: {tableName: '"remote"."main"."events"'}},
      }),
      stripCliCatalog,
    );
    expect(result.datasets.ds.source.tableName).toBe(
      '"remote"."main"."events"',
    );
  });

  test('leaves two-part schema.table identifier unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {ds: {source: {tableName: 'main.earthquakes'}}}),
      stripCliCatalog,
    );
    expect(result.datasets.ds.source.tableName).toBe('main.earthquakes');
  });

  test('leaves bare table name unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {ds: {source: {tableName: 'earthquakes'}}}),
      stripCliCatalog,
    );
    expect(result.datasets.ds.source.tableName).toBe('earthquakes');
  });

  test('does not touch transformSql or sqlQuery', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {
          source: {
            tableName: 'sqlrooms-cli.main.earthquakes',
            transformSql: 'SELECT * FROM __sqlrooms_source',
          },
        },
      }),
      stripCliCatalog,
    );
    expect(result.datasets.ds.source.tableName).toBe('main.earthquakes');
    expect(result.datasets.ds.source.transformSql).toBe(
      'SELECT * FROM __sqlrooms_source',
    );
  });

  test('does not rewrite SELECT *, ST_AsWKB(geom) AS geom collisions', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'ds', geometryColumn: 'geom'},
          },
        ],
        {
          ds: {
            source: {
              tableName: 'buildings',
              transformSql:
                'SELECT *, ST_AsWKB(geom) as geom FROM __sqlrooms_source',
            },
            geometryColumn: 'geom',
            geometryEncodingHint: 'wkb',
          },
        },
      ),
    );
    expect(result.datasets.ds.source.transformSql).toBe(
      'SELECT *, ST_AsWKB(geom) as geom FROM __sqlrooms_source',
    );
  });
});

describe('normalizeAiDeckMapConfig — mapStyle', () => {
  test('does not strip mapbox:// styles (validator rejects for agent retry)', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    const withMapbox = normalizeAiDeckMapConfig({
      ...result,
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
    });
    expect(withMapbox.mapStyle).toBe('mapbox://styles/mapbox/dark-v11');
  });

  test('keeps MapLibre-compatible https styles', () => {
    const result = normalizeAiDeckMapConfig({
      ...makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
      mapStyle: 'https://example.com/style.json',
    });
    expect(result.mapStyle).toBe('https://example.com/style.json');
  });
});

describe('normalizeAiDeckMapConfig — scaleLinear', () => {
  test('rewrites getElevation scaleLinear to scale', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds', geometryColumn: 'geom'},
            getElevation: {
              '@@function': 'scaleLinear',
              field: 'height',
              domain: 'auto',
              range: [0, 200],
            },
          },
        ],
        {
          ds: {
            source: {
              tableName: 'buildings',
              transformSql:
                'SELECT *, ST_AsWKB(ST_Centroid(geom)) AS geom FROM __sqlrooms_source',
            },
          },
        },
      ),
    );
    expect(getLayer(result).getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'height',
    });
  });

  test('does not rewrite getRadius scaleLinear (unsupported size scale)', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds', geometryColumn: 'geom'},
            getRadius: {
              '@@function': 'scaleLinear',
              field: 'Magnitude',
              domain: 'auto',
              range: [2, 20],
            },
          },
        ],
        {
          ds: {
            source: {
              tableName: 'earthquakes',
              transformSql:
                'SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM __sqlrooms_source',
            },
          },
        },
      ),
    );
    expect(getLayer(result).getRadius).toMatchObject({
      '@@function': 'scaleLinear',
      field: 'Magnitude',
    });
  });
});

describe('normalizeAiDeckMapConfig — colorScale type/scheme', () => {
  test('does not coerce quantile + Viridis (validator owns compatibility)', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'ds', hexagonColumn: 'hex_id'},
            getHexagon: '@@=hex_id',
            getFillColor: {
              '@@function': 'colorScale',
              field: 'value',
              type: 'quantile',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor).toMatchObject({
      type: 'quantile',
      scheme: 'Viridis',
      domain: 'auto',
      field: 'value',
    });
  });

  test('keeps quantile + YlOrRd unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'ds', hexagonColumn: 'hex_id'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'value',
              type: 'quantile',
              scheme: 'YlOrRd',
            },
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getFillColor).toMatchObject({
      type: 'quantile',
      scheme: 'YlOrRd',
    });
  });
});

// ---------------------------------------------------------------------------
// validateAndFixColorScaleFields
// ---------------------------------------------------------------------------
const VALIDATE_COLUMNS = [
  {name: 'Magnitude', type: 'FLOAT'},
  {name: 'Depth', type: 'FLOAT'},
  {name: 'EventID', type: 'VARCHAR'},
];

function makeValidateConfig(field: string) {
  return {
    spec: {
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          _sqlroomsBinding: {dataset: 'quakes'},
          getFillColor: {
            '@@function': 'colorScale',
            field,
            type: 'sequential',
            scheme: 'Viridis',
            domain: 'auto',
          },
        },
      ],
    },
    datasets: {
      quakes: {source: {tableName: 'earthquakes'}},
    },
  };
}

function resolveTable(tableName: string) {
  if (tableName === 'earthquakes') return {columns: VALIDATE_COLUMNS};
  return undefined;
}

describe('validateAndFixColorScaleFields', () => {
  test('leaves correct field name unchanged', () => {
    const config = makeValidateConfig('Magnitude');
    const result = validateAndFixColorScaleFields(config, resolveTable);
    expect((result.spec.layers[0].getFillColor as any).field).toBe('Magnitude');
  });

  test('silently fixes wrong casing (magnitude → Magnitude)', () => {
    const config = makeValidateConfig('magnitude');
    const result = validateAndFixColorScaleFields(config, resolveTable);
    expect((result.spec.layers[0].getFillColor as any).field).toBe('Magnitude');
  });

  test('throws with helpful message for unknown abbreviation "mag"', () => {
    const config = makeValidateConfig('mag');
    expect(() => validateAndFixColorScaleFields(config, resolveTable)).toThrow(
      /colorScale field "mag" is not a column in dataset "quakes"/,
    );
  });

  test('error message lists available columns', () => {
    const config = makeValidateConfig('mag');
    expect(() => validateAndFixColorScaleFields(config, resolveTable)).toThrow(
      /Available columns: Magnitude, Depth, EventID/,
    );
  });

  test('allows derived aliases mentioned in transformSql', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'quakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'derived_score',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {
        quakes: {
          source: {
            tableName: 'earthquakes',
            transformSql:
              'SELECT *, Magnitude * 2 AS derived_score, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM __sqlrooms_source',
          },
        },
      },
    };
    expect(() =>
      validateAndFixColorScaleFields(config, resolveTable),
    ).not.toThrow();
  });

  test('rejects typos absent from both base table and transformSql', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'quakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'totl',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {
        quakes: {
          source: {
            tableName: 'earthquakes',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM __sqlrooms_source',
          },
        },
      },
    };
    expect(() => validateAndFixColorScaleFields(config, resolveTable)).toThrow(
      /colorScale field "totl"/,
    );
  });

  test('silently fixes casing even when transformSql is present', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'quakes'},
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
      datasets: {
        quakes: {
          source: {
            tableName: 'earthquakes',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(Longitude, Latitude)) AS geom FROM __sqlrooms_source',
          },
        },
      },
    };
    const result = validateAndFixColorScaleFields(config, resolveTable);
    expect((result.spec.layers[0].getFillColor as any).field).toBe('Magnitude');
  });

  test('skips pure sqlQuery sources without tableName', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'quakes'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'mag',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {quakes: {source: {sqlQuery: 'SELECT * FROM earthquakes'}}},
    };
    expect(() =>
      validateAndFixColorScaleFields(config, resolveTable),
    ).not.toThrow();
  });

  test('skips non-colorScale accessors (flat array color)', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'quakes'},
            getFillColor: [255, 0, 0, 180],
          },
        ],
      },
      datasets: {quakes: {source: {tableName: 'earthquakes'}}},
    };
    expect(() =>
      validateAndFixColorScaleFields(config, resolveTable),
    ).not.toThrow();
  });

  test('silently fixes wrong casing for lowercase-named columns too (Speed → speed)', () => {
    const lowercaseColumns = [
      {name: 'speed', type: 'FLOAT'},
      {name: 'category', type: 'VARCHAR'},
    ];
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'Speed',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {ds: {source: {tableName: 'my_table'}}},
    };
    const result = validateAndFixColorScaleFields(config, (t) =>
      t === 'my_table' ? {columns: lowercaseColumns} : undefined,
    );
    expect((result.spec.layers[0].getFillColor as any).field).toBe('speed');
  });

  test('rejects an unknown field even when actual columns are lowercase', () => {
    const lowercaseColumns = [
      {name: 'speed', type: 'FLOAT'},
      {name: 'category', type: 'VARCHAR'},
    ];
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'spd',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {ds: {source: {tableName: 'my_table'}}},
    };
    expect(() =>
      validateAndFixColorScaleFields(config, (t) =>
        t === 'my_table' ? {columns: lowercaseColumns} : undefined,
      ),
    ).toThrow(
      /colorScale field "spd" is not a column.*Available columns: speed, category/,
    );
  });

  test('infers the sole dataset when _sqlroomsBinding.dataset is omitted', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'mag',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {
        quakes: {source: {tableName: 'earthquakes'}},
      },
    };
    expect(() => validateAndFixColorScaleFields(config, resolveTable)).toThrow(
      /colorScale field "mag" is not a column in dataset "quakes"/,
    );
  });

  test('uses the sole dataset when binding dataset id is a typo', () => {
    const config = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'quakez'},
            getFillColor: {
              '@@function': 'colorScale',
              field: 'mag',
              type: 'sequential',
              scheme: 'Viridis',
              domain: 'auto',
            },
          },
        ],
      },
      datasets: {
        quakes: {source: {tableName: 'earthquakes'}},
      },
    };
    expect(() => validateAndFixColorScaleFields(config, resolveTable)).toThrow(
      /colorScale field "mag" is not a column in dataset "quakes"/,
    );
  });
});

describe('normalizeAiDeckMapConfig — lon/lat transformSql injection', () => {
  test('injects point WKB transform when geometryColumn is absent', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
        {ds: {source: {tableName: 'places'}}},
      ),
    );
    // fitToData inject + lon/lat require fitToData lon/lat
    const withFit = normalizeAiDeckMapConfig({
      ...result,
      fitToData: {
        dataset: 'ds',
        longitudeColumn: 'Longitude',
        latitudeColumn: 'Latitude',
      },
      datasets: {
        ds: {source: {tableName: 'places'}},
      },
    } as any);
    expect(withFit.datasets.ds.geometryColumn).toBe('__sqlrooms_geom');
    expect(withFit.datasets.ds.source.transformSql).toContain(
      'ST_AsWKB(ST_Point',
    );
    expect(withFit.datasets.ds.source.transformSql).toContain(
      '__sqlrooms_geom',
    );
  });

  test('injects __sqlrooms_geom even when an authored geometryColumn was set', () => {
    const result = normalizeAiDeckMapConfig({
      configMode: 'basic',
      fitToData: {
        dataset: 'ds',
        longitudeColumn: 'Longitude',
        latitudeColumn: 'Latitude',
      },
      datasets: {
        ds: {
          source: {tableName: 'places'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds', geometryColumn: 'geom'},
          },
        ],
      },
    } as any);

    expect(result.datasets.ds.geometryColumn).toBe('__sqlrooms_geom');
    expect(result.datasets.ds.source.transformSql).toContain(
      'AS "__sqlrooms_geom"',
    );
    expect(getLayer(result)._sqlroomsBinding.geometryColumn).toBe(
      '__sqlrooms_geom',
    );
  });

  test('injects __sqlrooms_geom for GeoJsonLayer lon/lat maps', () => {
    const result = normalizeAiDeckMapConfig({
      configMode: 'basic',
      fitToData: {
        dataset: 'ds',
        longitudeColumn: 'lon',
        latitudeColumn: 'lat',
      },
      datasets: {
        ds: {source: {tableName: 'places'}},
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoJsonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
      },
    } as any);

    expect(result.datasets.ds.geometryColumn).toBe('__sqlrooms_geom');
    expect(result.datasets.ds.source.transformSql).toContain(
      'AS "__sqlrooms_geom"',
    );
    expect(getLayer(result)._sqlroomsBinding.geometryColumn).toBe(
      '__sqlrooms_geom',
    );
  });

  test('does not rewrite an existing column-only transformSql', () => {
    const sql =
      'SELECT Latitude, Longitude, Magnitude, Depth, DateTime FROM __sqlrooms_source';
    const result = normalizeAiDeckMapConfig({
      configMode: 'basic',
      fitToData: {
        dataset: 'earthquakes',
        longitudeColumn: 'Longitude',
        latitudeColumn: 'Latitude',
      },
      datasets: {
        earthquakes: {
          source: {
            tableName: '"main"."earthquakes"',
            transformSql: sql,
          },
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {
              dataset: 'earthquakes',
              longitudeColumn: 'Longitude',
              latitudeColumn: 'Latitude',
            },
          },
        ],
      },
    } as any);

    expect(result.datasets.earthquakes.source.transformSql).toBe(sql);
    expect(result.datasets.earthquakes.geometryColumn).toBeUndefined();
  });

  test('does not inject lon/lat transform for polygon-only layers with authored geom', () => {
    const result = normalizeAiDeckMapConfig({
      configMode: 'basic',
      fitToData: {
        dataset: 'ds',
        longitudeColumn: 'Longitude',
        latitudeColumn: 'Latitude',
      },
      datasets: {
        ds: {
          source: {tableName: 'buildings'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'ds', geometryColumn: 'geom'},
          },
        ],
      },
    } as any);

    expect(result.datasets.ds.geometryColumn).toBe('geom');
    expect(result.datasets.ds.source.transformSql).toBeUndefined();
  });
});
