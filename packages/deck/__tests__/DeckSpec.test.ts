import {DeckJsonMapSpec, LayerExtensionConfig} from '../src/DeckSpec';

describe('DeckJsonMapSpec', () => {
  it('accepts loose deck.gl layer objects while validating _sqlrooms', () => {
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
          _sqlrooms: {
            dataset: 'earthquakes',
            colorScale: {
              field: 'Magnitude',
              type: 'sequential',
              scheme: 'YlOrBr',
              domain: [0, 8],
            },
            colorScaleProp: 'getFillColor',
          },
        },
      ],
    });

    expect(parsed.layers?.[0]?.id).toBe('earthquakes');
    expect(parsed.layers?.[0]?._sqlrooms?.dataset).toBe('earthquakes');
  });

  it('rejects invalid _sqlrooms config', () => {
    expect(() =>
      DeckJsonMapSpec.parse({
        layers: [
          {
            '@@type': 'GeoArrowScatterplotLayer',
            _sqlrooms: {
              colorScaleProp: 'getStrokeColor',
            },
          },
        ],
      }),
    ).toThrow();
  });
});

describe('LayerExtensionConfig', () => {
  it('validates the full SQLRooms extension config', () => {
    expect(
      LayerExtensionConfig.parse({
        dataset: 'earthquakes',
        geometryColumn: 'geom',
        geometryEncodingHint: 'wkb',
        colorScaleProp: 'getFillColor',
      }),
    ).toEqual({
      dataset: 'earthquakes',
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
      colorScaleProp: 'getFillColor',
    });
  });
});
