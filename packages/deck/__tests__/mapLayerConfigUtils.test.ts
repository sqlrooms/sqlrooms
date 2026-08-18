import {
  clearDeckMapLayerColorScale,
  createDeckMapLayerColorScale,
  DECK_MAP_LAYER_TYPE_OPTIONS,
  getDeckMapColorAccessorOptions,
  getDeckMapLayerColorScale,
  getDeckMapLayerRecords,
  setDeckMapLayerGeometryColumn,
  setDeckMapLayerColorScale,
  setDeckMapLayerType,
  setDeckMapLayerColumnRadius,
  usesGeometryColumnSetting,
  usesExtrusionSettings,
  usesRadiusSetting,
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
  it('includes GeoArrowSolidPolygonLayer in layer-type options', () => {
    expect(DECK_MAP_LAYER_TYPE_OPTIONS.map((o) => o.value)).toContain(
      'GeoArrowSolidPolygonLayer',
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

  it('detects layer types that should use extrusion settings', () => {
    expect(usesExtrusionSettings('GeoArrowH3HexagonLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoArrowPolygonLayer')).toBe(true);
    expect(usesExtrusionSettings('GeoArrowColumnLayer')).toBe(true);
    // GeoJSON is not extrudable in the UI: elevation scale compile is geoarrow-only.
    expect(usesExtrusionSettings('GeoJsonLayer')).toBe(false);
    expect(usesExtrusionSettings('GeoArrowScatterplotLayer')).toBe(false);
    expect(usesExtrusionSettings('GeoArrowPathLayer')).toBe(false);
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
});
