import {DeckJsonMapSpec, LayerBindingConfig} from '../src/DeckJsonMapSpec';

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
            '@@function': 'sqlroomsColorScale',
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

  it('rejects invalid sqlroomsColorScale functions', () => {
    expect(() =>
      DeckJsonMapSpec.parse({
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            getFillColor: {
              '@@function': 'sqlroomsColorScale',
              field: 'Magnitude',
              type: 'sequential',
              scheme: 'NotAScheme',
              domain: [0, 8],
            },
          },
        ],
      }),
    ).toThrow();
  });
});

describe('LayerBindingConfig', () => {
  it('validates the full SQLRooms binding config', () => {
    expect(
      LayerBindingConfig.parse({
        dataset: 'earthquakes',
        geometryColumn: 'geom',
        geometryEncodingHint: 'wkb',
        sourceGeometryColumn: 'source_geom',
        targetGeometryColumn: 'target_geom',
        timestampColumn: 'timestamps',
        hexagonColumn: 'h3',
      }),
    ).toEqual({
      dataset: 'earthquakes',
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
      sourceGeometryColumn: 'source_geom',
      targetGeometryColumn: 'target_geom',
      timestampColumn: 'timestamps',
      hexagonColumn: 'h3',
    });
  });
});
