import {describe, expect, test} from '@jest/globals';
import type {DeckMapConfig} from '../src/mapConfig';
import {
  relaxDeckMapElevation,
  setManualElevationScale,
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

function configWith(
  layers: unknown[],
  configMode?: DeckMapConfig['configMode'],
): DeckMapConfig {
  return {
    spec: {layers},
    datasets: {},
    ...(configMode ? {configMode} : {}),
  };
}

function layerAt(config: DeckMapConfig, index = 0): Record<string, unknown> {
  return (config.spec as {layers: Record<string, unknown>[]}).layers[index]!;
}

describe('relaxDeckMapElevation', () => {
  test('drops a 100x multiplier on a scaled H3 elevation', () => {
    const next = relaxDeckMapElevation(configWith([h3Layer()]));
    expect(layerAt(next).elevationScale).toBeUndefined();
    expect(layerAt(next).getElevation).toMatchObject({
      '@@function': 'scale',
      range: [0, 200],
    });
  });

  test('drops the multiplier when H3 omits the extruded flag', () => {
    const next = relaxDeckMapElevation(
      configWith([h3Layer({extruded: undefined})]),
    );
    expect(layerAt(next).elevationScale).toBeUndefined();
  });

  test('drops the multiplier on a scaleLinear elevation accessor', () => {
    const next = relaxDeckMapElevation(
      configWith([
        h3Layer({
          getElevation: {...scaleElevation(), '@@function': 'scaleLinear'},
        }),
      ]),
    );
    expect(layerAt(next).elevationScale).toBeUndefined();
  });

  test('leaves a column layer elevation scale alone', () => {
    const input = configWith([
      {
        '@@type': 'GeoArrowColumnLayer',
        radius: 50,
        elevationScale: 100,
        getElevation: '@@=count',
      },
    ]);
    expect(relaxDeckMapElevation(input)).toBe(input);
    expect(layerAt(input).elevationScale).toBe(100);
  });

  test('leaves a flat polygon and a raw meter column alone', () => {
    const polygon = {
      '@@type': 'GeoArrowPolygonLayer',
      getElevation: scaleElevation(),
      elevationScale: 100,
    };
    const meters = {
      '@@type': 'GeoArrowH3HexagonLayer',
      extruded: true,
      getElevation: '@@=height_m',
      elevationScale: 1,
    };
    const input = configWith([polygon, meters]);
    expect(relaxDeckMapElevation(input)).toBe(input);
  });

  test('does not change an H3 layer with extrusion turned off', () => {
    const input = configWith([h3Layer({extruded: false})]);
    expect(relaxDeckMapElevation(input)).toBe(input);
  });

  test('leaves a non-positive elevation range when there is no stacked multiplier', () => {
    const input = configWith([
      h3Layer({getElevation: scaleElevation(0), elevationScale: 1}),
    ]);
    expect(relaxDeckMapElevation(input)).toBe(input);
  });

  test('keeps a manual slider value', () => {
    const layer = setManualElevationScale(h3Layer(), 4);
    const input = configWith([layer]);
    const next = relaxDeckMapElevation(input);
    expect(next).toBe(input);
    expect(layerAt(next).elevationScale).toBe(4);
  });

  test('is idempotent once the multiplier is gone', () => {
    const once = relaxDeckMapElevation(configWith([h3Layer()]));
    expect(relaxDeckMapElevation(once)).toBe(once);
  });

  test('leaves unrelated layers referentially equal', () => {
    const points = {
      '@@type': 'GeoArrowScatterplotLayer',
      getRadius: 4,
    };
    const next = relaxDeckMapElevation(configWith([h3Layer(), points]));
    expect(layerAt(next, 1)).toBe(points);
  });

  test('keeps an explicit numeric elevation when dropping a stacked multiplier', () => {
    const zero = relaxDeckMapElevation(
      configWith([h3Layer({getElevation: 0, elevationScale: 100})]),
    );
    expect(layerAt(zero).elevationScale).toBeUndefined();
    expect(layerAt(zero).getElevation).toBe(0);

    const meters = relaxDeckMapElevation(
      configWith([h3Layer({getElevation: 40, elevationScale: 100})]),
    );
    expect(layerAt(meters).elevationScale).toBeUndefined();
    expect(layerAt(meters).getElevation).toBe(40);
  });

  test('drops 100x on a missing elevation and on a custom config', () => {
    const bare = relaxDeckMapElevation(
      configWith([h3Layer({getElevation: undefined, elevationScale: 100})]),
    );
    expect(layerAt(bare).elevationScale).toBeUndefined();
    expect(layerAt(bare).getElevation).toBe(200);

    const raw = relaxDeckMapElevation(
      configWith([h3Layer({getElevation: '@@=count', elevationScale: 100})]),
    );
    expect(layerAt(raw).getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'count',
      range: [0, 200],
    });

    const custom = relaxDeckMapElevation(configWith([h3Layer()], 'custom'));
    expect(layerAt(custom).elevationScale).toBeUndefined();
  });

  test('leaves a meter column and a string spec alone', () => {
    const meters = configWith([
      h3Layer({
        getElevation: '@@=height_m',
        elevationScale: 1,
      }),
    ]);
    expect(relaxDeckMapElevation(meters)).toBe(meters);

    const stringSpec: DeckMapConfig = {
      spec: '{"layers":[]}',
      datasets: {},
    };
    expect(relaxDeckMapElevation(stringSpec)).toBe(stringSpec);
  });

  test('rewrites a zero range when it is stacked with a 100x multiplier', () => {
    const next = relaxDeckMapElevation(
      configWith([
        h3Layer({getElevation: scaleElevation(0), elevationScale: 100}),
      ]),
    );
    expect(layerAt(next).elevationScale).toBeUndefined();
    expect(layerAt(next).getElevation).toMatchObject({range: [0, 200]});
  });
});

describe('setManualElevationScale', () => {
  test('stores the slider value and preserves the existing binding', () => {
    const next = setManualElevationScale(h3Layer(), 2.5);
    expect(next.elevationScale).toBe(2.5);
    expect(next._sqlroomsBinding).toMatchObject({
      dataset: 'sites',
      hexagonColumn: 'h3',
      elevationScaleManual: true,
    });
  });
});
