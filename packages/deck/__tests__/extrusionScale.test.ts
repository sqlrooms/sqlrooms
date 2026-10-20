import {describe, expect, test} from '@jest/globals';
import {
  relaxStackedElevationScale,
  sizeDeckMapExtrusionToExtent,
  type DeckMapGroundBounds,
} from '../src/extrusionScale';

function scaleElevation(rangeMax = 200) {
  return {
    '@@function': 'scale',
    field: 'count',
    type: 'linear',
    domain: 'auto',
    range: [0, rangeMax],
  };
}

function h3Layer(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    '@@type': 'GeoArrowH3HexagonLayer',
    extruded: true,
    elevationScale: 100,
    getElevation: scaleElevation(),
    _sqlroomsBinding: {dataset: 'sites', hexagonColumn: 'h3'},
    ...overrides,
  };
}

describe('relaxStackedElevationScale', () => {
  test('drops a 100x multiplier on a scaled H3 elevation', () => {
    const next = relaxStackedElevationScale(h3Layer());
    expect(next.elevationScale).toBeUndefined();
    expect(next.getElevation).toMatchObject({
      '@@function': 'scale',
      range: [0, 200],
    });
  });

  test('drops the multiplier when H3 omits the extruded flag', () => {
    const next = relaxStackedElevationScale(h3Layer({extruded: undefined}));
    expect(next.elevationScale).toBeUndefined();
  });

  test('drops the multiplier on a scaleLinear elevation accessor', () => {
    const next = relaxStackedElevationScale(
      h3Layer({
        getElevation: {...scaleElevation(), '@@function': 'scaleLinear'},
      }),
    );
    expect(next.elevationScale).toBeUndefined();
  });

  test('drops the multiplier on a column layer too', () => {
    const next = relaxStackedElevationScale({
      '@@type': 'GeoArrowColumnLayer',
      radius: 50,
      elevationScale: 100,
      getElevation: '@@=count',
    });
    expect(next.elevationScale).toBeUndefined();
    expect(next.getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'count',
      range: [0, 200],
    });
  });

  test('leaves a flat polygon alone', () => {
    const polygon = {
      '@@type': 'GeoArrowPolygonLayer',
      getElevation: scaleElevation(),
      elevationScale: 100,
    };
    expect(relaxStackedElevationScale(polygon)).toBe(polygon);
  });

  test('does not change an H3 layer with extrusion turned off', () => {
    const layer = h3Layer({extruded: false});
    expect(relaxStackedElevationScale(layer)).toBe(layer);
  });

  test('leaves a slider-sized multiplier alone', () => {
    const layer = h3Layer({elevationScale: 4});
    expect(relaxStackedElevationScale(layer)).toBe(layer);
  });

  test('leaves a non-positive elevation range when there is no stacked multiplier', () => {
    const layer = h3Layer({
      getElevation: scaleElevation(0),
      elevationScale: 1,
    });
    expect(relaxStackedElevationScale(layer)).toBe(layer);
  });

  test('is idempotent once the multiplier is gone', () => {
    const once = relaxStackedElevationScale(h3Layer());
    expect(relaxStackedElevationScale(once)).toBe(once);
  });

  test('keeps an explicit numeric elevation when dropping a stacked multiplier', () => {
    const zero = relaxStackedElevationScale(
      h3Layer({getElevation: 0, elevationScale: 100}),
    );
    expect(zero.elevationScale).toBeUndefined();
    expect(zero.getElevation).toBe(0);

    const meters = relaxStackedElevationScale(
      h3Layer({getElevation: 40, elevationScale: 100}),
    );
    expect(meters.elevationScale).toBeUndefined();
    expect(meters.getElevation).toBe(40);
  });

  test('drops 100x on a missing elevation and on a raw column accessor', () => {
    const bare = relaxStackedElevationScale(
      h3Layer({getElevation: undefined, elevationScale: 100}),
    );
    expect(bare.elevationScale).toBeUndefined();
    expect(bare.getElevation).toBeUndefined();

    const raw = relaxStackedElevationScale(
      h3Layer({getElevation: '@@=count', elevationScale: 100}),
    );
    expect(raw.getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'count',
      range: [0, 200],
    });
  });

  test('leaves a raw meter column alone when there is no multiplier', () => {
    const layer = h3Layer({getElevation: '@@=height_m', elevationScale: 1});
    expect(relaxStackedElevationScale(layer)).toBe(layer);
  });

  test('rewrites a zero range when it is stacked with a 100x multiplier', () => {
    const next = relaxStackedElevationScale(
      h3Layer({getElevation: scaleElevation(0), elevationScale: 100}),
    );
    expect(next.elevationScale).toBeUndefined();
    expect(next.getElevation).toMatchObject({range: [0, 200]});
  });
});

/** East–west box of `meters` at the equator, where 1 degree is 111320 m. */
function equatorBounds(meters: number): DeckMapGroundBounds {
  return [
    [0, 0],
    [meters / 111320, 0],
  ];
}

function sizedLayer(
  spec: Record<string, unknown>,
  bounds: DeckMapGroundBounds | null,
): Record<string, unknown> {
  const next = sizeDeckMapExtrusionToExtent(spec, bounds) as {
    layers: Record<string, unknown>[];
  };
  return next.layers[0]!;
}

describe('sizeDeckMapExtrusionToExtent', () => {
  test('gives a 10km dataset 5km of relief', () => {
    const layer = sizedLayer(
      {layers: [h3Layer({elevationScale: undefined})]},
      equatorBounds(10_000),
    );
    // 5000m of relief over a 200m scale range.
    expect(layer.elevationScale).toBeCloseTo(25, 2);
  });

  test('scales a smaller site down in proportion', () => {
    const layer = sizedLayer(
      {layers: [h3Layer({elevationScale: undefined})]},
      equatorBounds(2_000),
    );
    expect(layer.elevationScale).toBeCloseTo(5, 2);
  });

  test('keeps the layer elevationScale as a multiplier on top', () => {
    const layer = sizedLayer(
      {layers: [h3Layer({elevationScale: 2})]},
      equatorBounds(10_000),
    );
    expect(layer.elevationScale).toBeCloseTo(50, 2);
  });

  test('sizes a column layer from the same extent', () => {
    const layer = sizedLayer(
      {
        layers: [
          {
            '@@type': 'GeoArrowColumnLayer',
            radius: 50,
            getElevation: scaleElevation(),
          },
        ],
      },
      equatorBounds(10_000),
    );
    expect(layer.elevationScale).toBeCloseTo(25, 2);
  });

  test('reads a globe-spanning dataset as the wide extent it is', () => {
    const layer = sizedLayer({layers: [h3Layer({elevationScale: undefined})]}, [
      [-170, 0],
      [170, 0],
    ]);
    // 340 degrees of ground, not the 20 a wrap-around reading would give.
    expect(layer.elevationScale).toBeCloseTo((340 * 111320 * 0.5) / 200, 0);
  });

  test('leaves layers bound to another dataset at their own scale', () => {
    const city = h3Layer({
      elevationScale: undefined,
      _sqlroomsBinding: {dataset: 'city'},
    });
    const country = h3Layer({
      elevationScale: undefined,
      _sqlroomsBinding: {dataset: 'country'},
    });
    const next = sizeDeckMapExtrusionToExtent(
      {layers: [country, city]},
      equatorBounds(10_000),
      'country',
    ) as {layers: Record<string, unknown>[]};
    expect(next.layers[0]!.elevationScale).toBeCloseTo(25, 2);
    expect(next.layers[1]).toBe(city);
  });

  test('leaves real meter elevations and flat layers alone', () => {
    const meters = {
      '@@type': 'GeoArrowH3HexagonLayer',
      extruded: true,
      getElevation: '@@=height_m',
    };
    const flat = {'@@type': 'GeoArrowScatterplotLayer', getRadius: 4};
    const spec = {layers: [meters, flat]};
    expect(sizeDeckMapExtrusionToExtent(spec, equatorBounds(10_000))).toBe(
      spec,
    );
  });

  test('leaves a degenerate extent unsized', () => {
    // A single point has no ground extent to scale against. Viewport padding
    // must not leak in here as if it were real.
    const point = 12.5;
    const spec = {layers: [h3Layer({elevationScale: undefined})]};
    expect(
      sizeDeckMapExtrusionToExtent(spec, [
        [point, point],
        [point, point],
      ]),
    ).toBe(spec);
  });

  test('returns the spec unchanged without bounds or for a string spec', () => {
    const spec = {layers: [h3Layer()]};
    expect(sizeDeckMapExtrusionToExtent(spec, null)).toBe(spec);
    expect(
      sizeDeckMapExtrusionToExtent('{"layers":[]}', equatorBounds(10_000)),
    ).toBe('{"layers":[]}');
  });

  test('returns the same spec when the sized scale is already in place', () => {
    // A 400m extent puts the top of a 200m range at its own range max.
    const spec = {layers: [h3Layer({elevationScale: 1})]};
    expect(sizeDeckMapExtrusionToExtent(spec, equatorBounds(400))).toBe(spec);
  });
});
