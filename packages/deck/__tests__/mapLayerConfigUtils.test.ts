import {
  clearDeckMapLayerColorScale,
  createDeckMapLayerColorScale,
  deckMapRgbaToHex,
  DECK_MAP_LAYER_TYPE_OPTIONS,
  getDeckMapColorAccessorOptions,
  getDeckMapLayerColorScale,
  getDeckMapLayerExtruded,
  getDeckMapLayerFlatColor,
  getDeckMapLayerRecords,
  getDeckMapLayerStrokeDefault,
  replaceDeckMapLayerColorScaleWithFlat,
  replaceDeckMapLayerColorScalesWithFlat,
  setDeckMapLayerColumnRadius,
  setDeckMapLayerColorScale,
  setDeckMapLayerFlatColor,
  setDeckMapLayerGeometryColumn,
  setDeckMapLayerType,
  updateDeckMapLayer,
  usesExtrusionSettings,
  usesGeometryColumnSetting,
  usesRadiusSetting,
  usesStrokeSetting,
  withDeckMapLayerOpacityFromFlatAlpha,
  withoutDeckMapLayerOpacityIfUnused,
} from '../src/mapLayerConfigUtils';

const config = {
  spec: {
    layers: [
      {
        '@@type': 'GeoArrowScatterplotLayer',
        id: 'points',
        _sqlroomsBinding: {dataset: 'places'},
        getRadius: 4,
      },
    ],
  },
  datasets: {
    places: {
      source: {tableName: 'places'},
      geometryColumn: 'geom',
    },
  },
};

describe('mapLayerConfigUtils', () => {
  it('omits GeoArrowSolidPolygonLayer from layer-type options', () => {
    // Prefer Polygon / GeoJSON in the UI; SolidPolygon remains loadable at runtime.
    expect(DECK_MAP_LAYER_TYPE_OPTIONS.map((o) => o.value)).not.toContain(
      'GeoArrowSolidPolygonLayer',
    );
    expect(DECK_MAP_LAYER_TYPE_OPTIONS.map((o) => o.value)).toContain(
      'GeoArrowPolygonLayer',
    );
    expect(DECK_MAP_LAYER_TYPE_OPTIONS.map((o) => o.value)).toContain(
      'GeoJsonLayer',
    );
  });
  it('updates layer type without changing dataset bindings', () => {
    const nextConfig = setDeckMapLayerType(config, 0, 'GeoArrowHeatmapLayer');

    expect(getDeckMapLayerRecords(nextConfig)[0]).toMatchObject({
      '@@type': 'GeoArrowHeatmapLayer',
      id: 'points',
      _sqlroomsBinding: {dataset: 'places'},
    });
    expect(config.spec.layers[0]['@@type']).toBe('GeoArrowScatterplotLayer');
  });

  it('forces column radius to meters and strips point radius leftovers', () => {
    const nextConfig = setDeckMapLayerType(
      {
        ...config,
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowScatterplotLayer',
              id: 'points',
              _sqlroomsBinding: {dataset: 'places'},
              getRadius: 5,
              radiusUnits: 'pixels',
              radiusMinPixels: 5,
              radiusMaxPixels: 45,
            },
          ],
        },
      },
      0,
      'GeoArrowColumnLayer',
    );

    const layer = getDeckMapLayerRecords(nextConfig)[0];
    expect(layer?.['@@type']).toBe('GeoArrowColumnLayer');
    expect(layer?.radius).toBe(50);
    expect(layer?.radiusUnits).toBe('meters');
    expect(layer?.getRadius).toBeUndefined();
    expect(layer?.radiusMinPixels).toBeUndefined();
    expect(layer?.radiusMaxPixels).toBeUndefined();
  });

  it('writes column radius in meters via setDeckMapLayerColumnRadius', () => {
    const columnConfig = setDeckMapLayerType(config, 0, 'GeoArrowColumnLayer');
    const next = setDeckMapLayerColumnRadius(columnConfig, 0, 300);
    const layer = getDeckMapLayerRecords(next)[0];
    expect(layer?.radius).toBe(300);
    expect(layer?.radiusUnits).toBe('meters');
  });

  it('stores color scale accessors as native Deck JSON functions', () => {
    const colorScale = createDeckMapLayerColorScale({
      field: 'magnitude',
      type: 'sequential',
      scheme: 'Viridis',
    });

    const nextConfig = setDeckMapLayerColorScale(
      config,
      0,
      'getFillColor',
      colorScale,
    );

    expect(
      getDeckMapLayerColorScale(
        getDeckMapLayerRecords(nextConfig)[0],
        'getFillColor',
      ),
    ).toEqual({
      '@@function': 'colorScale',
      field: 'magnitude',
      type: 'sequential',
      scheme: 'Viridis',
      domain: 'auto',
      legend: {title: 'magnitude'},
    });
  });

  it('updates the bound dataset geometry column for geometry-backed layers', () => {
    const nextConfig = setDeckMapLayerGeometryColumn(config, 0, 'geometry');

    expect(nextConfig.datasets.places.geometryColumn).toBe('geometry');
    expect(config.datasets.places.geometryColumn).toBe('geom');
  });

  it('detects layer types that should use geometry column settings', () => {
    expect(usesGeometryColumnSetting('GeoArrowPolygonLayer')).toBe(true);
    expect(usesGeometryColumnSetting('GeoArrowSolidPolygonLayer')).toBe(true);
    expect(usesGeometryColumnSetting('GeoJsonLayer')).toBe(true);
    expect(usesGeometryColumnSetting('GeoArrowScatterplotLayer')).toBe(false);
  });

  it('detects layer types that should use point radius settings', () => {
    expect(usesRadiusSetting('GeoArrowScatterplotLayer')).toBe(true);
    expect(usesRadiusSetting('GeoJsonLayer')).toBe(true);
    expect(usesRadiusSetting('GeoArrowPathLayer')).toBe(false);
    expect(usesRadiusSetting('GeoArrowColumnLayer')).toBe(false);
  });

  it('detects layer types that should use stroke settings', () => {
    expect(usesStrokeSetting('GeoArrowScatterplotLayer')).toBe(true);
    expect(usesStrokeSetting('GeoArrowH3HexagonLayer')).toBe(true);
    expect(usesStrokeSetting('GeoArrowPolygonLayer')).toBe(true);
    // SolidPolygon outlines use wireframe, not stroked — hide Stroke UI.
    expect(usesStrokeSetting('GeoArrowSolidPolygonLayer')).toBe(false);
    expect(usesStrokeSetting('GeoJsonLayer')).toBe(true);
    expect(usesStrokeSetting('GeoArrowPathLayer')).toBe(false);
    expect(usesStrokeSetting('GeoArrowHeatmapLayer')).toBe(false);
  });

  it('detects layer types that should use extrusion settings', () => {
    expect(usesExtrusionSettings('GeoArrowH3HexagonLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoArrowPolygonLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoArrowColumnLayer')).toBe(true);
    // GeoJSON is not extrudable in the UI: elevation scale compile is geoarrow-only.
    expect(usesExtrusionSettings('GeoJsonLayer')).toBe(false);
    expect(usesExtrusionSettings('GeoArrowScatterplotLayer')).toBe(false);
    expect(usesExtrusionSettings('GeoArrowPathLayer')).toBe(false);
  });

  it('returns deck defaults for stroked when omitted', () => {
    expect(getDeckMapLayerStrokeDefault('GeoArrowScatterplotLayer')).toBe(
      false,
    );
    expect(getDeckMapLayerStrokeDefault('GeoArrowSolidPolygonLayer')).toBe(
      false,
    );
    expect(getDeckMapLayerStrokeDefault('GeoArrowPolygonLayer')).toBe(true);
    // H3 defaults extruded → stroke off unless extruded is explicitly false.
    expect(getDeckMapLayerStrokeDefault('GeoArrowH3HexagonLayer')).toBe(false);
    expect(
      getDeckMapLayerStrokeDefault('GeoArrowH3HexagonLayer', {extruded: true}),
    ).toBe(false);
    expect(
      getDeckMapLayerStrokeDefault('GeoArrowH3HexagonLayer', {extruded: false}),
    ).toBe(true);
    expect(getDeckMapLayerStrokeDefault('GeoJsonLayer')).toBe(true);
  });
});

describe('getDeckMapLayerExtruded', () => {
  it('defaults H3 to extruded when the prop is omitted', () => {
    expect(getDeckMapLayerExtruded({'@@type': 'GeoArrowH3HexagonLayer'})).toBe(
      true,
    );
    expect(
      getDeckMapLayerExtruded({
        '@@type': 'GeoArrowH3HexagonLayer',
        extruded: false,
      }),
    ).toBe(false);
    expect(getDeckMapLayerExtruded({'@@type': 'GeoArrowPolygonLayer'})).toBe(
      false,
    );
  });
});

describe('withoutDeckMapLayerOpacityIfUnused', () => {
  it('keeps opacity when another accessor still has a color scale', () => {
    const layer = {
      '@@type': 'GeoArrowPolygonLayer',
      opacity: 0.5,
      getFillColor: createDeckMapLayerColorScale({field: 'mag'}),
      getLineColor: [0, 0, 0, 128],
    };
    expect(withoutDeckMapLayerOpacityIfUnused(layer, 'getLineColor')).toEqual(
      layer,
    );
  });

  it('clears opacity when no color-scale channel remains', () => {
    const layer = {
      '@@type': 'GeoArrowPolygonLayer',
      opacity: 0.5,
      getFillColor: [56, 189, 248, 180],
      getLineColor: [0, 0, 0, 128],
    };
    expect(withoutDeckMapLayerOpacityIfUnused(layer)).toEqual({
      '@@type': 'GeoArrowPolygonLayer',
      getFillColor: [56, 189, 248, 90],
      getLineColor: [0, 0, 0, 64],
    });
  });

  it('bakes opacity into sibling flat channels when dropping it', () => {
    const next = replaceDeckMapLayerColorScaleWithFlat(
      {
        '@@type': 'GeoArrowPolygonLayer',
        opacity: 0.5,
        getFillColor: createDeckMapLayerColorScale({field: 'mag'}),
        getLineColor: [0, 0, 0, 255],
      },
      'getFillColor',
      [56, 189, 248, 180],
    );
    expect(next.opacity).toBeUndefined();
    expect(next.getFillColor).toEqual([56, 189, 248, 90]);
    expect(next.getLineColor).toEqual([0, 0, 0, 128]);
  });
});

describe('getDeckMapColorAccessorOptions', () => {
  test('ColumnLayer exposes only getFillColor', () => {
    const opts = getDeckMapColorAccessorOptions('GeoArrowColumnLayer');
    expect(opts.map((o) => o.value)).toEqual(['getFillColor']);
  });

  test('HeatmapLayer exposes no color accessors', () => {
    expect(getDeckMapColorAccessorOptions('GeoArrowHeatmapLayer')).toHaveLength(
      0,
    );
  });

  test('ScatterplotLayer exposes getFillColor and getLineColor', () => {
    const opts = getDeckMapColorAccessorOptions('GeoArrowScatterplotLayer');
    expect(opts.map((o) => o.value)).toEqual(['getFillColor', 'getLineColor']);
  });

  test('PathLayer exposes only getColor', () => {
    const opts = getDeckMapColorAccessorOptions('GeoArrowPathLayer');
    expect(opts.map((o) => o.value)).toEqual(['getColor']);
  });

  test('ArcLayer exposes getSourceColor and getTargetColor', () => {
    const opts = getDeckMapColorAccessorOptions('GeoArrowArcLayer');
    expect(opts.map((o) => o.value)).toEqual([
      'getSourceColor',
      'getTargetColor',
    ]);
  });
});

describe('clearDeckMapLayerColorScale', () => {
  const defaultColor = [56, 189, 248, 180];

  test('restores a flat default color for getFillColor', () => {
    const withScale = setDeckMapLayerColorScale(
      config,
      0,
      'getFillColor',
      createDeckMapLayerColorScale({field: 'mag'}),
    );
    const cleared = clearDeckMapLayerColorScale(withScale, 0, 'getFillColor');
    expect(getDeckMapLayerRecords(cleared)[0]?.getFillColor).toEqual(
      defaultColor,
    );
  });

  test('restores a flat default color for PathLayer getColor (not black)', () => {
    const pathConfig = {
      ...config,
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowPathLayer',
            id: 'paths',
            _sqlroomsBinding: {dataset: 'places'},
            getColor: createDeckMapLayerColorScale({field: 'mag'}),
          },
        ],
      },
    };
    const cleared = clearDeckMapLayerColorScale(pathConfig, 0, 'getColor');
    expect(getDeckMapLayerRecords(cleared)[0]?.getColor).toEqual(defaultColor);
  });

  test('restores stroke default for getLineColor', () => {
    const withScale = setDeckMapLayerColorScale(
      config,
      0,
      'getLineColor',
      createDeckMapLayerColorScale({field: 'mag'}),
    );
    const cleared = clearDeckMapLayerColorScale(withScale, 0, 'getLineColor');
    expect(getDeckMapLayerRecords(cleared)[0]?.getLineColor).toEqual([
      0, 0, 0, 255,
    ]);
  });

  test('bakes layer.opacity into flat alpha when clearing the last scale', () => {
    const withScale = updateDeckMapLayer(
      setDeckMapLayerColorScale(
        config,
        0,
        'getFillColor',
        createDeckMapLayerColorScale({field: 'mag'}),
      ),
      0,
      (layer) => ({...layer, opacity: 0.5}),
    );
    const cleared = clearDeckMapLayerColorScale(withScale, 0, 'getFillColor');
    const layer = getDeckMapLayerRecords(cleared)[0];
    expect(layer?.opacity).toBeUndefined();
    expect(layer?.getFillColor).toEqual([56, 189, 248, 90]);
  });

  test('keeps layer.opacity when another color scale remains', () => {
    const withScales = updateDeckMapLayer(
      setDeckMapLayerColorScale(
        setDeckMapLayerColorScale(
          config,
          0,
          'getFillColor',
          createDeckMapLayerColorScale({field: 'mag'}),
        ),
        0,
        'getLineColor',
        createDeckMapLayerColorScale({field: 'cat'}),
      ),
      0,
      (layer) => ({...layer, opacity: 0.5}),
    );
    const cleared = clearDeckMapLayerColorScale(withScales, 0, 'getLineColor');
    const layer = getDeckMapLayerRecords(cleared)[0];
    expect(layer?.opacity).toBe(0.5);
    expect(layer?.getLineColor).toEqual([0, 0, 0, 255]);
    expect(getDeckMapLayerColorScale(layer, 'getFillColor')).toBeTruthy();
  });
});

describe('replaceDeckMapLayerColorScaleWithFlat', () => {
  test('clears a stroke scale left behind when disabling stroke', () => {
    const layer = {
      '@@type': 'GeoArrowPolygonLayer',
      stroked: false,
      opacity: 0.4,
      getFillColor: createDeckMapLayerColorScale({field: 'mag'}),
      getLineColor: createDeckMapLayerColorScale({field: 'cat'}),
    };
    const next = replaceDeckMapLayerColorScaleWithFlat(
      layer,
      'getLineColor',
      [0, 0, 0, 255],
    );
    expect(next.opacity).toBe(0.4);
    expect(next.getLineColor).toEqual([0, 0, 0, 255]);
    expect(getDeckMapLayerColorScale(next, 'getFillColor')).toBeTruthy();
  });

  test('preserves an already-flat arc endpoint when clearing only the scaled one', () => {
    const next = replaceDeckMapLayerColorScalesWithFlat(
      {
        '@@type': 'GeoArrowArcLayer',
        opacity: 0.5,
        getSourceColor: createDeckMapLayerColorScale({field: 'mag'}),
        getTargetColor: [10, 20, 30, 255],
      },
      {getSourceColor: [56, 189, 248, 180]},
    );
    expect(next.opacity).toBeUndefined();
    expect(next.getSourceColor).toEqual([56, 189, 248, 90]);
    expect(next.getTargetColor).toEqual([10, 20, 30, 128]);
  });
});

describe('withDeckMapLayerOpacityFromFlatAlpha', () => {
  test('sets opacity from flat alpha when no other scale owns it', () => {
    expect(
      withDeckMapLayerOpacityFromFlatAlpha(
        {'@@type': 'GeoArrowScatterplotLayer', getFillColor: [1, 2, 3, 128]},
        128,
        'getFillColor',
      ).opacity,
    ).toBeCloseTo(128 / 255);
  });

  test('leaves opacity alone when another color scale remains', () => {
    const layer = {
      '@@type': 'GeoArrowPolygonLayer',
      opacity: 0.25,
      getFillColor: createDeckMapLayerColorScale({field: 'mag'}),
      getLineColor: [0, 0, 0, 200],
    };
    expect(
      withDeckMapLayerOpacityFromFlatAlpha(layer, 200, 'getLineColor'),
    ).toEqual(layer);
  });
});

describe('deck map flat layer color', () => {
  test('reads and writes a flat RGBA color', () => {
    const next = setDeckMapLayerFlatColor(
      config,
      0,
      'getFillColor',
      [10, 20, 30, 40],
    );
    expect(
      getDeckMapLayerFlatColor(getDeckMapLayerRecords(next)[0], 'getFillColor'),
    ).toEqual([10, 20, 30, 40]);
  });

  test('deckMapRgbaToHex converts RGB channels', () => {
    expect(deckMapRgbaToHex([255, 128, 0, 200])).toBe('#ff8000');
  });
});
