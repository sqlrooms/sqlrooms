import {
  createDeckMapLayerColorScale,
  getDeckMapLayerColorScale,
  getDeckMapLayerRecords,
  setDeckMapLayerGeometryColumn,
  setDeckMapLayerColorScale,
  setDeckMapLayerType,
  usesGeometryColumnSetting,
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
});
