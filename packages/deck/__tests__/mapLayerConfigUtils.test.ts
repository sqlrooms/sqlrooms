import {
  clearDeckMapLayerColorScale,
  createDeckMapLayerColorScale,
  getDeckMapColorAccessorOptions,
  getDeckMapLayerColorScale,
  getDeckMapLayerRecords,
  setDeckMapLayerGeometryColumn,
  setDeckMapLayerColorScale,
  setDeckMapLayerType,
  usesGeometryColumnSetting,
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
  it('updates layer type without changing dataset bindings', () => {
    const nextConfig = setDeckMapLayerType(config, 0, 'GeoArrowHeatmapLayer');

    expect(getDeckMapLayerRecords(nextConfig)[0]).toMatchObject({
      '@@type': 'GeoArrowHeatmapLayer',
      id: 'points',
      _sqlroomsBinding: {dataset: 'places'},
    });
    expect(config.spec.layers[0]['@@type']).toBe('GeoArrowScatterplotLayer');
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
});
