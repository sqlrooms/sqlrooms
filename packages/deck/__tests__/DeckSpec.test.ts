import {
  ColorScaleFunction,
  DeckJsonMapSpec,
  LayerBindingConfig,
} from '../src/DeckJsonMapSpec';

describe('DeckJsonMapSpec', () => {
  it('accepts loose deck.gl layer objects while validating _sqlroomsBinding', () => {
    const parsed = DeckJsonMapSpec.parse({
      initialViewState: {
        longitude: -119.5,
        latitude: 37,
        zoom: 4.5,
      },
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: 'earthquakes',
          filled: true,
          radiusMinPixels: 1,
          _sqlroomsBinding: {
            dataset: 'earthquakes',
          },
          getFillColor: {
            '@@function': 'colorScale',
            field: 'Magnitude',
            type: 'sequential',
            scheme: 'YlOrBr',
            domain: [0, 8],
          },
        },
      ],
    });

    expect(parsed.layers?.[0]?.id).toBe('earthquakes');
    expect(parsed.layers?.[0]?._sqlroomsBinding?.dataset).toBe('earthquakes');
  });

  it('rejects invalid colorScale functions via ColorScaleFunction schema', () => {
    expect(() =>
      ColorScaleFunction.parse({
        '@@function': 'colorScale',
        field: 'Magnitude',
        type: 'sequential',
        scheme: 'NotAScheme',
        domain: [0, 8],
      }),
    ).toThrow(/scheme/i);
  });
});

describe('LayerBindingConfig', () => {
  it('validates the full SQLRooms binding config', () => {
    expect(
      LayerBindingConfig.parse({
        dataset: 'earthquakes',
        geometryColumn: 'geom',
        geometryEncodingHint: 'wkb',
        longitudeColumn: 'longitude',
        latitudeColumn: 'latitude',
        sourceGeometryColumn: 'source_geom',
        targetGeometryColumn: 'target_geom',
        sourceLongitudeColumn: 'origin_lon',
        sourceLatitudeColumn: 'origin_lat',
        targetLongitudeColumn: 'dest_lon',
        targetLatitudeColumn: 'dest_lat',
        timestampColumn: 'timestamps',
        hexagonColumn: 'h3',
        generatedTransform: {
          kind: 'arc',
          sourceGeometryColumn: 'source_geom',
          targetGeometryColumn: 'target_geom',
        },
      }),
    ).toEqual({
      dataset: 'earthquakes',
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
      longitudeColumn: 'longitude',
      latitudeColumn: 'latitude',
      sourceGeometryColumn: 'source_geom',
      targetGeometryColumn: 'target_geom',
      sourceLongitudeColumn: 'origin_lon',
      sourceLatitudeColumn: 'origin_lat',
      targetLongitudeColumn: 'dest_lon',
      targetLatitudeColumn: 'dest_lat',
      timestampColumn: 'timestamps',
      hexagonColumn: 'h3',
      generatedTransform: {
        kind: 'arc',
        sourceGeometryColumn: 'source_geom',
        targetGeometryColumn: 'target_geom',
      },
    });
  });
});
