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
  DECK_MAP_DEFAULT_LAYER_COLOR,
  updateDeckMapLayer,
  usesExtrusionSettings,
  usesGeometryColumnSetting,
  usesRadiusSetting,
  usesStrokeSetting,
  usesStrokeExtrusionWarning,
  detachDeckMapLayerOpacity,
  getDeckMapColorScaleOpacity,
  getDeckMapLayerChannelOpacityPercent,
} from '../src/mapLayerConfigUtils';
import {DEFAULT_HEATMAP_COLOR_RANGE} from '../src/json/heatmapDefaults';

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
    expect(getDeckMapLayerRecords(nextConfig)[0]?.colorRange).toEqual(
      DEFAULT_HEATMAP_COLOR_RANGE,
    );
    expect(config.spec.layers[0]['@@type']).toBe('GeoArrowScatterplotLayer');
  });

  it('keeps an existing heatmap colorRange when switching to heatmap', () => {
    const customRange = [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ];
    const heatmapConfig = setDeckMapLayerType(
      config,
      0,
      'GeoArrowHeatmapLayer',
    );
    const withCustomRange = updateDeckMapLayer(heatmapConfig, 0, (layer) => ({
      ...layer,
      colorRange: customRange,
    }));

    const nextConfig = setDeckMapLayerType(
      withCustomRange,
      0,
      'GeoArrowHeatmapLayer',
    );

    expect(getDeckMapLayerRecords(nextConfig)[0]?.colorRange).toEqual(
      customRange,
    );
  });

  it('writes the default fill color when switching heatmap to point', () => {
    const heatmapConfig = setDeckMapLayerType(
      config,
      0,
      'GeoArrowHeatmapLayer',
    );
    const withoutFill = updateDeckMapLayer(heatmapConfig, 0, (layer) => {
      const next = {...layer};
      delete next.getFillColor;
      return next;
    });

    const nextConfig = setDeckMapLayerType(
      withoutFill,
      0,
      'GeoArrowScatterplotLayer',
    );
    const layer = getDeckMapLayerRecords(nextConfig)[0];

    expect(layer?.['@@type']).toBe('GeoArrowScatterplotLayer');
    expect(layer?.getFillColor).toEqual([...DECK_MAP_DEFAULT_LAYER_COLOR]);
  });

  it('keeps an existing fill color when switching heatmap back to point', () => {
    const customFill = [255, 0, 0, 255];
    const withFill = updateDeckMapLayer(config, 0, (layer) => ({
      ...layer,
      getFillColor: customFill,
    }));
    const heatmapConfig = setDeckMapLayerType(
      withFill,
      0,
      'GeoArrowHeatmapLayer',
    );

    const nextConfig = setDeckMapLayerType(
      heatmapConfig,
      0,
      'GeoArrowScatterplotLayer',
    );

    expect(getDeckMapLayerRecords(nextConfig)[0]?.getFillColor).toEqual(
      customFill,
    );
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

  it('warns that polygon, geojson, and h3 strokes are ignored while extruded', () => {
    expect(usesStrokeExtrusionWarning('GeoArrowPolygonLayer')).toBe(true);
    expect(usesStrokeExtrusionWarning('GeoJsonLayer')).toBe(true);
    expect(usesStrokeExtrusionWarning('GeoArrowH3HexagonLayer')).toBe(true);
    expect(usesStrokeExtrusionWarning('GeoArrowSolidPolygonLayer')).toBe(false);
    expect(usesStrokeExtrusionWarning('GeoArrowScatterplotLayer')).toBe(false);
    expect(usesStrokeExtrusionWarning('GeoArrowColumnLayer')).toBe(false);
  });

  it('detects layer types that should use extrusion settings', () => {
    expect(usesExtrusionSettings('GeoArrowH3HexagonLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoArrowPolygonLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoArrowColumnLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoJsonLayer')).toBe(true);
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
    expect(getDeckMapLayerExtruded({'@@type': 'GeoArrowColumnLayer'})).toBe(
      true,
    );
    expect(
      getDeckMapLayerExtruded({
        '@@type': 'GeoArrowColumnLayer',
        extruded: false,
      }),
    ).toBe(false);
  });
});

describe('detachDeckMapLayerOpacity', () => {
  it('bakes layer.opacity into flat color alphas and drops opacity', () => {
    const next = detachDeckMapLayerOpacity({
      '@@type': 'GeoArrowPolygonLayer',
      opacity: 0.5,
      getFillColor: [56, 189, 248, 180],
      getLineColor: [0, 0, 0, 128],
    });
    expect(next).toEqual({
      '@@type': 'GeoArrowPolygonLayer',
      getFillColor: [56, 189, 248, 90],
      getLineColor: [0, 0, 0, 64],
    });
  });

  it('bakes layer.opacity into sibling flat channels when clearing a scale', () => {
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

describe('getDeckMapLayerChannelOpacityPercent', () => {
  test('includes legacy layer.opacity for a flat accessor', () => {
    expect(
      getDeckMapLayerChannelOpacityPercent(
        {
          '@@type': 'GeoArrowScatterplotLayer',
          opacity: 0.5,
          getFillColor: [56, 189, 248, 255],
        },
        'getFillColor',
      ),
    ).toBe(50);
  });

  test('includes legacy layer.opacity for a color scale', () => {
    expect(
      getDeckMapLayerChannelOpacityPercent(
        {
          '@@type': 'GeoArrowPolygonLayer',
          opacity: 0.5,
          getFillColor: createDeckMapLayerColorScale({
            field: 'mag',
            opacity: 1,
          }),
        },
        'getFillColor',
      ),
    ).toBe(50);
  });

  test('writing the displayed percent after detach keeps the same alpha', () => {
    const layer = {
      '@@type': 'GeoArrowScatterplotLayer',
      opacity: 0.5,
      getFillColor: [56, 189, 248, 255] as [number, number, number, number],
    };
    const displayed = getDeckMapLayerChannelOpacityPercent(
      layer,
      'getFillColor',
    );
    const detached = detachDeckMapLayerOpacity(layer);
    const next = {
      ...detached,
      getFillColor: [56, 189, 248, Math.round((displayed / 100) * 255)],
    };
    expect(next.opacity).toBeUndefined();
    expect(next.getFillColor).toEqual(detached.getFillColor);
    expect(getDeckMapLayerChannelOpacityPercent(next, 'getFillColor')).toBe(
      displayed,
    );
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

  test('bakes colorScale.opacity into flat alpha when clearing', () => {
    const withScale = setDeckMapLayerColorScale(
      config,
      0,
      'getFillColor',
      createDeckMapLayerColorScale({field: 'mag', opacity: 0.5}),
    );
    const cleared = clearDeckMapLayerColorScale(withScale, 0, 'getFillColor');
    const layer = getDeckMapLayerRecords(cleared)[0];
    expect(layer?.opacity).toBeUndefined();
    expect(layer?.getFillColor).toEqual([56, 189, 248, 128]);
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

  test('moves layer.opacity onto remaining colorScale when clearing another channel', () => {
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
    expect(layer?.opacity).toBeUndefined();
    expect(layer?.getLineColor).toEqual([0, 0, 0, 128]);
    expect(
      getDeckMapColorScaleOpacity(
        getDeckMapLayerColorScale(layer, 'getFillColor'),
      ),
    ).toBe(0.5);
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
    expect(next.opacity).toBeUndefined();
    expect(next.getLineColor).toEqual([0, 0, 0, 102]);
    expect(
      getDeckMapColorScaleOpacity(
        getDeckMapLayerColorScale(next, 'getFillColor'),
      ),
    ).toBe(0.4);
  });

  test('keeps fill and stroke opacity independent after detach', () => {
    const layer = detachDeckMapLayerOpacity({
      '@@type': 'GeoArrowScatterplotLayer',
      opacity: 0.5,
      getFillColor: createDeckMapLayerColorScale({
        field: 'mag',
        opacity: 1,
      }),
      getLineColor: [0, 0, 0, 255],
    });
    expect(layer.opacity).toBeUndefined();
    expect(
      getDeckMapColorScaleOpacity(
        getDeckMapLayerColorScale(layer, 'getFillColor'),
      ),
    ).toBe(0.5);
    expect(layer.getLineColor).toEqual([0, 0, 0, 128]);

    const next = {
      ...layer,
      getLineColor: [0, 0, 0, 64] as [number, number, number, number],
    };
    expect(
      getDeckMapColorScaleOpacity(
        getDeckMapLayerColorScale(next, 'getFillColor'),
      ),
    ).toBe(0.5);
    expect(next.getLineColor).toEqual([0, 0, 0, 64]);
  });

  it('materializes implicit default stroke before dropping opacity', () => {
    const next = detachDeckMapLayerOpacity({
      '@@type': 'GeoArrowPolygonLayer',
      opacity: 0.5,
      getFillColor: [56, 189, 248, 180],
    });
    expect(next.opacity).toBeUndefined();
    expect(next.getFillColor).toEqual([56, 189, 248, 90]);
    expect(next.getLineColor).toEqual([0, 0, 0, 128]);
  });

  it('does not materialize scatterplot stroke when stroked is omitted', () => {
    const next = detachDeckMapLayerOpacity({
      '@@type': 'GeoArrowScatterplotLayer',
      opacity: 0.5,
      getFillColor: [56, 189, 248, 255],
    });
    expect(next.getLineColor).toBeUndefined();
    expect(next.getFillColor).toEqual([56, 189, 248, 128]);
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

  test('round-trips default fill alpha when toggling a color scale', () => {
    const withScale = replaceDeckMapLayerColorScaleWithFlat(
      {
        '@@type': 'GeoArrowScatterplotLayer',
        getFillColor: createDeckMapLayerColorScale({
          field: 'mag',
          opacity: 180 / 255,
        }),
      },
      'getFillColor',
      [56, 189, 248, 180],
    );
    expect(withScale.getFillColor).toEqual([56, 189, 248, 180]);
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
