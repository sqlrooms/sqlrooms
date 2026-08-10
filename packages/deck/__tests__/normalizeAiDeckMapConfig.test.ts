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
// Layer class alias normalisation
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — shadow layer removal (type switch)', () => {
  test('removes the hidden scatterplot when a visible heatmap was added (point→heatmap switch)', () => {
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
    expect(result.spec.layers).toHaveLength(1);
    expect(getLayer(result)['@@type']).toBe('GeoArrowHeatmapLayer');
  });

  test('keeps both layers when they are the same @@type', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'a',
            _sqlroomsBinding: {dataset: 'ds'},
            visible: false,
          },
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'b',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(result.spec.layers).toHaveLength(2);
  });

  test('keeps all layers when all are visible', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'a',
            _sqlroomsBinding: {dataset: 'ds'},
          },
          {
            '@@type': 'GeoArrowHeatmapLayer',
            id: 'b',
            _sqlroomsBinding: {dataset: 'ds'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(result.spec.layers).toHaveLength(2);
  });
});

describe('normalizeAiDeckMapConfig — layer class aliases', () => {
  test.each([
    ['ScatterplotLayer', 'GeoArrowScatterplotLayer'],
    ['HeatmapLayer', 'GeoArrowHeatmapLayer'],
    ['ColumnLayer', 'GeoArrowColumnLayer'],
    ['PathLayer', 'GeoArrowPathLayer'],
    ['PolygonLayer', 'GeoArrowPolygonLayer'],
    ['SolidPolygonLayer', 'GeoArrowSolidPolygonLayer'],
    ['ArcLayer', 'GeoArrowArcLayer'],
    ['TripsLayer', 'GeoArrowTripsLayer'],
    ['H3HexagonLayer', 'GeoArrowH3HexagonLayer'],
  ])('renames %s → %s', (input, expected) => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([{'@@type': input, _sqlroomsBinding: {dataset: 'ds'}}], {
        ds: {source: {tableName: 'ds'}},
      }),
    );
    expect(getLayer(result)['@@type']).toBe(expected);
  });

  test('leaves already-correct GeoArrow names unchanged', () => {
    const config = makeConfig(
      [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          _sqlroomsBinding: {dataset: 'ds'},
        },
      ],
      {ds: {source: {tableName: 'ds'}}},
    );
    const result = normalizeAiDeckMapConfig(config);
    expect(getLayer(result)['@@type']).toBe('GeoArrowScatterplotLayer');
  });
});

// ---------------------------------------------------------------------------
// Color accessor syntax repair
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — color accessor syntax', () => {
  test('fixes @@type:ColorScale + column → @@function:colorScale + field', () => {
    const layer = {
      '@@type': 'GeoArrowScatterplotLayer',
      _sqlroomsBinding: {dataset: 'ds'},
      getFillColor: {
        '@@type': 'ColorScale',
        column: 'magnitude',
        type: 'sequential',
        scheme: 'Viridis',
      },
    };
    const result = normalizeAiDeckMapConfig(
      makeConfig([layer], {ds: {source: {tableName: 'ds'}}}),
    );
    const fill = getLayer(result).getFillColor;
    expect(fill['@@function']).toBe('colorScale');
    expect(fill.field).toBe('magnitude');
    expect(fill['@@type']).toBeUndefined();
    expect(fill.column).toBeUndefined();
  });

  test('applies fix to all colour accessor props', () => {
    const layer = {
      '@@type': 'GeoArrowArcLayer',
      _sqlroomsBinding: {dataset: 'ds'},
      getSourceColor: {
        '@@type': 'ColorScale',
        column: 'src',
        type: 'sequential',
        scheme: 'Blues',
      },
      getTargetColor: {
        '@@type': 'ColorScale',
        column: 'tgt',
        type: 'sequential',
        scheme: 'Reds',
      },
    };
    const result = normalizeAiDeckMapConfig(
      makeConfig([layer], {ds: {source: {tableName: 'ds'}}}),
    );
    expect(getLayer(result).getSourceColor['@@function']).toBe('colorScale');
    expect(getLayer(result).getSourceColor.field).toBe('src');
    expect(getLayer(result).getTargetColor['@@function']).toBe('colorScale');
    expect(getLayer(result).getTargetColor.field).toBe('tgt');
  });

  test('removes a broken ColorScale object that has no resolvable field', () => {
    const layer = {
      '@@type': 'GeoArrowScatterplotLayer',
      _sqlroomsBinding: {dataset: 'ds'},
      getFillColor: {'@@type': 'ColorScale'},
    };
    const result = normalizeAiDeckMapConfig(
      makeConfig([layer], {ds: {source: {tableName: 'ds'}}}),
    );
    // Broken accessor is removed; default fill injector then applies.
    expect(getLayer(result).getFillColor).toEqual([56, 189, 248, 180]);
  });

  test('leaves a valid @@function colorScale accessor unchanged', () => {
    const colorScale = {
      '@@function': 'colorScale',
      field: 'mag',
      type: 'sequential',
      scheme: 'Viridis',
      domain: 'auto',
    };
    const layer = {
      '@@type': 'GeoArrowScatterplotLayer',
      _sqlroomsBinding: {dataset: 'ds'},
      getFillColor: colorScale,
    };
    const result = normalizeAiDeckMapConfig(
      makeConfig([layer], {ds: {source: {tableName: 'ds'}}}),
    );
    expect(getLayer(result).getFillColor).toEqual(colorScale);
  });

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

  test('fixes mixed-case scheme name (e.g. "viridis" → "Viridis")', () => {
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

  test('fixes scheme casing on non-fill color props (getLineColor, getColor)', () => {
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
// colorRange stripped from heatmap
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

  test('also strips colorRange after class alias is applied (HeatmapLayer)', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'HeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            colorRange: [[0, 0, 255]],
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result)['@@type']).toBe('GeoArrowHeatmapLayer');
    expect(getLayer(result).colorRange).toBeUndefined();
  });

  test('does not touch colorRange on other layer types', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            colorRange: [[1, 2, 3]],
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).colorRange).toEqual([[1, 2, 3]]);
  });
});

// ---------------------------------------------------------------------------
// heatmap getWeight invalid accessor
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — heatmap getWeight', () => {
  test('converts {"@@function":"getNumericColumn","field":"Magnitude"} to "@@=Magnitude"', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWeight: {'@@function': 'getNumericColumn', field: 'Magnitude'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getWeight).toBe('@@=Magnitude');
  });

  test('converts object with "column" key to "@@=column"', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWeight: {'@@function': 'fieldAccessor', column: 'Depth'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getWeight).toBe('@@=Depth');
  });

  test('removes unresolvable object accessor, leaving getWeight absent', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWeight: {'@@function': 'unknown'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getWeight).toBeUndefined();
  });

  test('leaves a valid "@@=Column" string accessor unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWeight: '@@=Magnitude',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getWeight).toBe('@@=Magnitude');
  });

  test('leaves a numeric getWeight unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWeight: 1,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getWeight).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// H3 getHexagon invalid accessor
// ---------------------------------------------------------------------------
describe('normalizeAiDeckMapConfig — H3 getHexagon', () => {
  test('rewrites columnAccessor object to @@= string using column', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getHexagon: {'@@function': 'columnAccessor', column: 'hex_id'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getHexagon).toBe('@@=hex_id');
    expect(getLayer(result)._sqlroomsBinding.hexagonColumn).toBe('hex_id');
  });

  test('rewrites object with field key to @@= string', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getHexagon: {'@@function': 'getColumn', field: 'h3index'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getHexagon).toBe('@@=h3index');
    expect(getLayer(result)._sqlroomsBinding.hexagonColumn).toBe('h3index');
  });

  test('removes unresolvable object accessor, leaving getHexagon absent', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowH3HexagonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getHexagon: {'@@function': 'unknown'},
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getHexagon).toBeUndefined();
  });

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
});
// getRadius — string and zero/negative clamping (basic mode only)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — getRadius', () => {
  test('replaces string getRadius with numeric default in basic mode', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: 'Magnitude * 500',
            radiusUnits: 'pixels',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getRadius).toBe(4);
    expect(getLayer(result).radiusUnits).toBe('pixels');
    expect(getLayer(result).radiusScale).toBeUndefined();
  });

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
  });

  test('leaves valid numeric getRadius unchanged', () => {
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

  test('does not clamp string getRadius in custom mode', () => {
    const result = normalizeAiDeckMapConfig({
      configMode: 'custom' as const,
      ...makeConfig(
        [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getRadius: '@@=radius_col',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    });
    expect(getLayer(result).getRadius).toBe('@@=radius_col');
  });
});

// ---------------------------------------------------------------------------
// getWidth — string clamping and missing widthUnits (basic mode only)
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — getWidth', () => {
  test.each(['GeoArrowPathLayer', 'GeoArrowArcLayer', 'GeoArrowTripsLayer'])(
    'replaces string getWidth with numeric default on %s in basic mode',
    (type) => {
      const result = normalizeAiDeckMapConfig(
        makeBasicConfig(
          [
            {
              '@@type': type,
              _sqlroomsBinding: {dataset: 'ds'},
              getWidth: 'flow * 10',
            },
          ],
          {ds: {source: {tableName: 'ds'}}},
        ),
      );
      expect(getLayer(result).getWidth).toBe(2);
      expect(getLayer(result).widthUnits).toBe('pixels');
      expect(getLayer(result).widthScale).toBeUndefined();
    },
  );

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

  test('does not overwrite an existing widthUnits when numeric getWidth is present', () => {
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
    // widthUnits is already set, but it's not "pixels" — normalization only
    // injects when absent; it doesn't overwrite an explicit meters choice.
    expect(getLayer(result).widthUnits).toBe('pixels');
  });

  test('fixes inverted widthMaxPixels < widthMinPixels', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowPathLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getWidth: 5,
            widthUnits: 'pixels',
            widthMinPixels: 20,
            widthMaxPixels: 10,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    const layer = getLayer(result);
    expect(layer.widthMinPixels).toBe(20);
    expect(layer.widthMaxPixels).toBe(20);
    expect(layer.getWidth).toBe(20);
    expect(layer.widthUnits).toBe('pixels');
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

  test('clamps string radiusPixels to default', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowHeatmapLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radiusPixels: 'density * 10',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radiusPixels).toBe(30);
  });

  test('leaves valid positive radiusPixels unchanged', () => {
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
    expect(getLayer(result).radius).toBe(50);
  });

  test('clamps string radius to default meters', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowColumnLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            radius: 'count * 5',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).radius).toBe(50);
  });

  test('leaves valid positive radius unchanged', () => {
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
    expect(layer.radius).toBe(50);
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
    expect(getLayer(result).radius).toBe(50);
    expect(getLayer(result).radiusUnits).toBe('meters');
  });
});

// ---------------------------------------------------------------------------
// getElevation — string stripped in basic mode
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — getElevation', () => {
  test.each([
    'GeoArrowPolygonLayer',
    'GeoArrowSolidPolygonLayer',
    'GeoArrowColumnLayer',
    'GeoArrowH3HexagonLayer',
  ])('strips string getElevation on %s in basic mode', (type) => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': type,
            _sqlroomsBinding: {dataset: 'ds'},
            getElevation: 'floors * 3',
            elevationScale: 10,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getElevation).toBe(0);
    expect(getLayer(result).elevationScale).toBeUndefined();
  });

  test('leaves numeric getElevation unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeBasicConfig(
        [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getElevation: 100,
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    );
    expect(getLayer(result).getElevation).toBe(100);
  });

  test('does not strip string getElevation in custom mode', () => {
    const result = normalizeAiDeckMapConfig({
      configMode: 'custom' as const,
      ...makeConfig(
        [
          {
            '@@type': 'GeoArrowPolygonLayer',
            _sqlroomsBinding: {dataset: 'ds'},
            getElevation: '@@=height',
          },
        ],
        {ds: {source: {tableName: 'ds'}}},
      ),
    });
    expect(getLayer(result).getElevation).toBe('@@=height');
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
  test('strips catalog from three-part unquoted identifier', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {source: {tableName: 'sqlrooms-cli.main.earthquakes'}},
      }),
    );
    expect(result.datasets.ds.source.tableName).toBe('main.earthquakes');
  });

  test('strips catalog from three-part quoted identifier', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        ds: {source: {tableName: '"sqlrooms-cli"."main"."earthquakes"'}},
      }),
    );
    expect(result.datasets.ds.source.tableName).toBe('"main"."earthquakes"');
  });

  test('leaves two-part schema.table identifier unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {ds: {source: {tableName: 'main.earthquakes'}}}),
    );
    expect(result.datasets.ds.source.tableName).toBe('main.earthquakes');
  });

  test('leaves bare table name unchanged', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {ds: {source: {tableName: 'earthquakes'}}}),
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
    );
    expect(result.datasets.ds.source.tableName).toBe('main.earthquakes');
    expect(result.datasets.ds.source.transformSql).toBe(
      'SELECT * FROM __sqlrooms_source',
    );
  });
});

// ---------------------------------------------------------------------------
// ST_MakeLine ORDER BY → LIST wrap
// ---------------------------------------------------------------------------

describe('normalizeAiDeckMapConfig — ST_MakeLine LIST wrap', () => {
  test('wraps ST_MakeLine(ST_Point(...) ORDER BY ...) with LIST', () => {
    const result = normalizeAiDeckMapConfig(
      makeConfig(
        [
          {
            '@@type': 'GeoArrowTripsLayer',
            _sqlroomsBinding: {
              dataset: 'trips',
              timestampColumn: 'timestamps',
            },
          },
        ],
        {
          trips: {
            source: {
              tableName: 'nyc_trips_animated',
              transformSql:
                'SELECT path_id, ST_AsWKB(ST_MakeLine(ST_Point(lon, lat) ORDER BY waypoint_order)) AS geom, LIST(timestamp ORDER BY waypoint_order) AS timestamps FROM __sqlrooms_source GROUP BY path_id',
            },
          },
        },
      ),
    );
    expect(result.datasets.trips.source.transformSql).toContain(
      'ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))',
    );
    expect(result.datasets.trips.source.transformSql).not.toMatch(
      /ST_MakeLine\(\s*ST_Point\([^)]*\)\s+ORDER\s+BY/i,
    );
  });

  test('leaves already-correct ST_MakeLine(LIST(...)) unchanged', () => {
    const sql =
      'SELECT path_id, ST_AsWKB(ST_MakeLine(LIST(ST_Point(lon, lat) ORDER BY waypoint_order))) AS geom FROM __sqlrooms_source GROUP BY path_id';
    const result = normalizeAiDeckMapConfig(
      makeConfig([], {
        trips: {source: {tableName: 'trips', transformSql: sql}},
      }),
    );
    expect(result.datasets.trips.source.transformSql).toBe(sql);
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

  test('reports wrong casing as an error (magnitude instead of Magnitude)', () => {
    const config = makeValidateConfig('magnitude');
    expect(() => validateAndFixColorScaleFields(config, resolveTable)).toThrow(
      /colorScale field "magnitude" has wrong casing — use "Magnitude"/,
    );
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

  test('skips datasets with transformSql (output schema is unknown)', () => {
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
      datasets: {
        quakes: {
          source: {
            tableName: 'earthquakes',
            transformSql:
              'SELECT *, ST_Point(lon, lat) as geom FROM __sqlrooms_source',
          },
        },
      },
    };
    expect(() =>
      validateAndFixColorScaleFields(config, resolveTable),
    ).not.toThrow();
  });

  test('skips datasets with sqlQuery', () => {
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

  test('reports wrong casing for lowercase-named columns too (Speed vs speed)', () => {
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
    expect(() =>
      validateAndFixColorScaleFields(config, (t) =>
        t === 'my_table' ? {columns: lowercaseColumns} : undefined,
      ),
    ).toThrow(/colorScale field "Speed" has wrong casing — use "speed"/);
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
});
