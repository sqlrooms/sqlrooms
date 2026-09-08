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
  setDeckMapLayerCoordinateColumns,
  setDeckMapLayerArcGeometryColumns,
  setDeckMapLayerArcCoordinateColumns,
  setDeckMapLayerType,
  DECK_MAP_DEFAULT_LAYER_COLOR,
  updateDeckMapLayer,
  usesExtrusionSettings,
  usesGeometryColumnSetting,
  usesPointCoordinateSetting,
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

  it('stores a single lat/lon pick without dropping a source geometry column', () => {
    const nextConfig = setDeckMapLayerCoordinateColumns(
      config,
      0,
      {latitudeColumn: 'latitude'},
      [
        {name: 'geom', type: 'GEOMETRY'},
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    );

    expect(nextConfig.fitToData).toMatchObject({
      dataset: 'places',
      geometryColumn: 'geom',
      latitudeColumn: 'latitude',
    });
    expect(nextConfig.fitToData).not.toHaveProperty('longitudeColumn');
    expect(nextConfig.datasets.places.geometryColumn).toBe('geom');
    expect(nextConfig.datasets.places.source).toEqual({tableName: 'places'});
  });

  it('applies a point transform once both lat and lon are selected', () => {
    const afterLatitude = setDeckMapLayerCoordinateColumns(
      config,
      0,
      {latitudeColumn: 'latitude'},
      [
        {name: 'geom', type: 'GEOMETRY'},
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    );
    const nextConfig = setDeckMapLayerCoordinateColumns(
      afterLatitude,
      0,
      {longitudeColumn: 'longitude'},
      [
        {name: 'geom', type: 'GEOMETRY'},
        {name: 'longitude', type: 'DOUBLE'},
        {name: 'latitude', type: 'DOUBLE'},
      ],
    );

    expect(nextConfig.fitToData).toMatchObject({
      dataset: 'places',
      latitudeColumn: 'latitude',
      longitudeColumn: 'longitude',
    });
    expect(nextConfig.datasets.places.geometryColumn).toBe('__sqlrooms_geom');
    expect(nextConfig.datasets.places.source).toMatchObject({
      tableName: 'places',
      transformSql: expect.stringContaining(
        'ST_Point("longitude", "latitude")',
      ),
    });
    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).toMatchObject({
      dataset: 'places',
      geometryColumn: '__sqlrooms_geom',
    });
  });

  it('switches a lon/lat point map back to a source geometry column', () => {
    const pointConfig = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            id: 'points',
            _sqlroomsBinding: {
              dataset: 'places',
              geometryColumn: '__sqlrooms_geom',
            },
          },
        ],
      },
      datasets: {
        places: {
          source: {
            tableName: 'places',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point("longitude", "latitude")) AS "__sqlrooms_geom" FROM __sqlrooms_source WHERE "longitude" IS NOT NULL AND "latitude" IS NOT NULL',
          },
          geometryColumn: '__sqlrooms_geom',
          geometryEncodingHint: 'wkb' as const,
        },
      },
      fitToData: {
        dataset: 'places',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
        padding: 40,
        maxZoom: 12,
      },
    };

    const nextConfig = setDeckMapLayerGeometryColumn(pointConfig, 0, 'geom');

    expect(nextConfig.datasets.places.geometryColumn).toBe('geom');
    expect(nextConfig.datasets.places.source).toEqual({tableName: 'places'});
    expect(nextConfig.fitToData).toMatchObject({
      dataset: 'places',
      geometryColumn: 'geom',
    });
    expect(nextConfig.fitToData).not.toHaveProperty('longitudeColumn');
    expect(nextConfig.fitToData).not.toHaveProperty('latitudeColumn');
    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).toMatchObject({
      dataset: 'places',
      geometryColumn: 'geom',
    });
  });

  it('keeps lon/lat fit when the generated point geometry column is reselected', () => {
    const transformSql =
      'SELECT *, ST_AsWKB(ST_Point("longitude", "latitude")) AS "__sqlrooms_geom" FROM __sqlrooms_source WHERE "longitude" IS NOT NULL AND "latitude" IS NOT NULL';
    const pointConfig = {
      spec: {
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlroomsBinding: {
              dataset: 'places',
              geometryColumn: '__sqlrooms_geom',
            },
          },
        ],
      },
      datasets: {
        places: {
          source: {tableName: 'places', transformSql},
          geometryColumn: '__sqlrooms_geom',
        },
      },
      fitToData: {
        dataset: 'places',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
      },
    };

    const nextConfig = setDeckMapLayerGeometryColumn(
      pointConfig,
      0,
      '__sqlrooms_geom',
    );

    expect(nextConfig.datasets.places.source).toEqual({
      tableName: 'places',
      transformSql,
    });
    expect(nextConfig.fitToData).toEqual(pointConfig.fitToData);
  });

  it('detects layer types that should use geometry column settings', () => {
    expect(usesGeometryColumnSetting('GeoArrowPolygonLayer')).toBe(true);
    expect(usesGeometryColumnSetting('GeoArrowSolidPolygonLayer')).toBe(true);
    expect(usesGeometryColumnSetting('GeoJsonLayer')).toBe(true);
    expect(usesGeometryColumnSetting('GeoArrowScatterplotLayer')).toBe(false);
    expect(usesPointCoordinateSetting('GeoArrowScatterplotLayer')).toBe(true);
    expect(usesPointCoordinateSetting('GeoArrowHeatmapLayer')).toBe(true);
    expect(usesPointCoordinateSetting('GeoArrowColumnLayer')).toBe(true);
    expect(usesPointCoordinateSetting('GeoArrowPolygonLayer')).toBe(false);
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

describe('arc geometry vs lon/lat bindings', () => {
  const arcConfig = {
    spec: {
      layers: [
        {
          '@@type': 'GeoArrowArcLayer',
          id: 'arcs',
          _sqlroomsBinding: {
            dataset: 'trips',
            sourceGeometryColumn: 'origin_geom',
            targetGeometryColumn: 'dest_geom',
          },
        },
      ],
    },
    datasets: {
      trips: {
        source: {tableName: 'trips'},
        geometryColumn: 'origin_geom',
      },
    },
    fitToData: {
      dataset: 'trips',
      geometryColumns: ['origin_geom', 'dest_geom'],
      padding: 40,
      maxZoom: 12,
    },
  };
  const sourceColumns = [
    {name: 'origin_geom', type: 'GEOMETRY'},
    {name: 'dest_geom', type: 'GEOMETRY'},
    {name: 'origin_lon', type: 'DOUBLE'},
    {name: 'origin_lat', type: 'DOUBLE'},
    {name: 'dest_lon', type: 'DOUBLE'},
    {name: 'dest_lat', type: 'DOUBLE'},
  ];

  it('stores a partial arc lon/lat pick without dropping source geoms', () => {
    const nextConfig = setDeckMapLayerArcCoordinateColumns(
      arcConfig,
      0,
      {sourceLatitudeColumn: 'origin_lat'},
      sourceColumns,
    );

    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).toMatchObject({
      sourceGeometryColumn: 'origin_geom',
      targetGeometryColumn: 'dest_geom',
      sourceLatitudeColumn: 'origin_lat',
    });
    expect(nextConfig.datasets.trips.source).toEqual({tableName: 'trips'});
  });

  it('applies an arc transform once all four lon/lat columns are selected', () => {
    const nextConfig = [
      {sourceLatitudeColumn: 'origin_lat'},
      {sourceLongitudeColumn: 'origin_lon'},
      {targetLatitudeColumn: 'dest_lat'},
      {targetLongitudeColumn: 'dest_lon'},
    ].reduce(
      (config, columns) =>
        setDeckMapLayerArcCoordinateColumns(config, 0, columns, sourceColumns),
      arcConfig,
    );

    expect(nextConfig.datasets.trips.source).toMatchObject({
      tableName: 'trips',
      transformSql: expect.stringContaining(
        'ST_Point("origin_lon", "origin_lat")',
      ),
    });
    expect(String(nextConfig.datasets.trips.source.transformSql)).toContain(
      'ST_Point("dest_lon", "dest_lat")',
    );
    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).toMatchObject({
      sourceGeometryColumn: 'source_geom',
      targetGeometryColumn: 'target_geom',
      sourceLatitudeColumn: 'origin_lat',
      sourceLongitudeColumn: 'origin_lon',
      targetLatitudeColumn: 'dest_lat',
      targetLongitudeColumn: 'dest_lon',
    });
    expect(nextConfig.fitToData).toMatchObject({
      dataset: 'trips',
      geometryColumns: ['source_geom', 'target_geom'],
    });
    expect(nextConfig.datasets.trips.geometryEncodingHint).toBe('wkb');
  });

  it('uses fallback aliases when source_geom and target_geom already exist', () => {
    const nextConfig = setDeckMapLayerArcCoordinateColumns(
      arcConfig,
      0,
      {
        sourceLatitudeColumn: 'origin_lat',
        sourceLongitudeColumn: 'origin_lon',
        targetLatitudeColumn: 'dest_lat',
        targetLongitudeColumn: 'dest_lon',
      },
      [
        ...sourceColumns,
        {name: 'source_geom', type: 'GEOMETRY'},
        {name: 'target_geom', type: 'GEOMETRY'},
      ],
    );

    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).toMatchObject({
      sourceGeometryColumn: '__sqlrooms_source_geom',
      targetGeometryColumn: '__sqlrooms_target_geom',
    });
  });

  it('switches an arc lon/lat map back to source geometry columns', () => {
    const lonLatConfig = setDeckMapLayerArcCoordinateColumns(
      arcConfig,
      0,
      {
        sourceLatitudeColumn: 'origin_lat',
        sourceLongitudeColumn: 'origin_lon',
        targetLatitudeColumn: 'dest_lat',
        targetLongitudeColumn: 'dest_lon',
      },
      sourceColumns,
    );
    const nextConfig = setDeckMapLayerArcGeometryColumns(lonLatConfig, 0, {
      sourceGeometryColumn: 'origin_geom',
      targetGeometryColumn: 'dest_geom',
    });

    expect(nextConfig.datasets.trips.source).toEqual({tableName: 'trips'});
    expect(nextConfig.fitToData).toMatchObject({
      dataset: 'trips',
      geometryColumns: ['origin_geom', 'dest_geom'],
    });
    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).toMatchObject({
      dataset: 'trips',
      sourceGeometryColumn: 'origin_geom',
      targetGeometryColumn: 'dest_geom',
    });
    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).not.toHaveProperty('sourceLatitudeColumn');
    expect(
      getDeckMapLayerRecords(nextConfig)[0]?._sqlroomsBinding,
    ).not.toHaveProperty('targetLongitudeColumn');
  });
});
