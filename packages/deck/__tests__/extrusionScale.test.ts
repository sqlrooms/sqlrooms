import {describe, expect, test} from '@jest/globals';
import type {DeckMapConfig} from '../src/mapConfig';
import {
  EXTRUSION_HEIGHT_EXTENT_FRACTION,
  applyExtrusionScaleToGroundExtent,
  elevationScaleForGroundExtent,
  setManualElevationScale,
  shorterGroundExtentMeters,
  type GroundExtentBounds,
} from '../src/extrusionScale';

const METERS_PER_DEGREE_LAT = 111_320;

/** Equatorial square about 2km on a side (0.018° ≈ 2004m), centered on lat 0. */
const SITE_2KM: GroundExtentBounds = [
  [0, -0.009],
  [0.018, 0.009],
];

/** Equatorial rectangle: 2km north-south, about 20km east-west. */
const THIN_SITE: GroundExtentBounds = [
  [0, -0.009],
  [0.18, 0.009],
];

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

describe('shorterGroundExtentMeters', () => {
  test('measures an equatorial square in meters', () => {
    expect(shorterGroundExtentMeters(SITE_2KM)).toBeCloseTo(
      0.018 * METERS_PER_DEGREE_LAT,
      6,
    );
  });

  test('uses the shorter side', () => {
    expect(shorterGroundExtentMeters(THIN_SITE)).toBeCloseTo(
      0.018 * METERS_PER_DEGREE_LAT,
      6,
    );
  });

  test('shrinks longitude at high latitude', () => {
    const bounds: GroundExtentBounds = [
      [0, 60],
      [1, 61],
    ];
    const midLat = 60.5;
    expect(shorterGroundExtentMeters(bounds)).toBeCloseTo(
      METERS_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180),
      5,
    );
  });

  test('returns 0 for an empty box or non-finite coordinates', () => {
    expect(
      shorterGroundExtentMeters([
        [0, 0],
        [0, 0],
      ]),
    ).toBe(0);
    expect(
      shorterGroundExtentMeters([
        [Number.NaN, 0],
        [1, 1],
      ]),
    ).toBe(0);
  });
});

describe('elevationScaleForGroundExtent', () => {
  test('divides the extent target by the scale range max', () => {
    const shorter = shorterGroundExtentMeters(SITE_2KM);
    expect(elevationScaleForGroundExtent(SITE_2KM, 200)).toBeCloseTo(
      (shorter * EXTRUSION_HEIGHT_EXTENT_FRACTION) / 200,
    );
  });

  test('returns undefined when the range or extent cannot scale', () => {
    expect(elevationScaleForGroundExtent(SITE_2KM, 0)).toBeUndefined();
    expect(
      elevationScaleForGroundExtent(
        [
          [0, 0],
          [0, 0],
        ],
        200,
      ),
    ).toBeUndefined();
  });
});

describe('applyExtrusionScaleToGroundExtent', () => {
  test('replaces an extra AI multiplier so a 2km H3 site stays a fraction of its width', () => {
    const layer = h3Layer();
    const next = applyExtrusionScaleToGroundExtent(
      configWith([layer]),
      SITE_2KM,
    );
    const scaled = (next.spec as {layers: Record<string, unknown>[]})
      .layers[0]!;
    const shorter = shorterGroundExtentMeters(SITE_2KM);
    const scale = scaled.elevationScale as number;

    expect(scale).toBeCloseTo(
      (shorter * EXTRUSION_HEIGHT_EXTENT_FRACTION) / 200,
    );
    expect(scale).not.toBe(100);
    // 200m range × scale ≈ 12% of ~2km, a few hundred meters — not tens of km.
    expect(200 * scale).toBeCloseTo(shorter * EXTRUSION_HEIGHT_EXTENT_FRACTION);
    expect(200 * scale).toBeLessThan(1_000);
  });

  test('grows the column with a wider site', () => {
    const wide: GroundExtentBounds = [
      [0, 0],
      [0.36, 0.36],
    ];
    const small = applyExtrusionScaleToGroundExtent(
      configWith([h3Layer()]),
      SITE_2KM,
    );
    const large = applyExtrusionScaleToGroundExtent(
      configWith([h3Layer()]),
      wide,
    );
    const smallScale = (small.spec as {layers: Array<{elevationScale: number}>})
      .layers[0]!.elevationScale;
    const largeScale = (large.spec as {layers: Array<{elevationScale: number}>})
      .layers[0]!.elevationScale;
    expect(largeScale).toBeCloseTo(smallScale * 20);
  });

  test('treats an omitted H3 extruded flag as extruded', () => {
    const next = applyExtrusionScaleToGroundExtent(
      configWith([h3Layer({extruded: undefined, elevationScale: undefined})]),
      SITE_2KM,
    );
    const scale = (next.spec as {layers: Array<{elevationScale?: number}>})
      .layers[0]!.elevationScale;
    expect(scale).toBeCloseTo(
      (shorterGroundExtentMeters(SITE_2KM) * EXTRUSION_HEIGHT_EXTENT_FRACTION) /
        200,
    );
  });

  test('uses range max of 1 as the full target height in meters', () => {
    const next = applyExtrusionScaleToGroundExtent(
      configWith([
        h3Layer({getElevation: scaleElevation(1), elevationScale: 50}),
      ]),
      SITE_2KM,
    );
    const scale = (next.spec as {layers: Array<{elevationScale: number}>})
      .layers[0]!.elevationScale;
    expect(scale).toBeCloseTo(
      shorterGroundExtentMeters(SITE_2KM) * EXTRUSION_HEIGHT_EXTENT_FRACTION,
    );
  });

  test('accepts a scaleLinear elevation accessor', () => {
    const next = applyExtrusionScaleToGroundExtent(
      configWith([
        h3Layer({
          getElevation: {...scaleElevation(), '@@function': 'scaleLinear'},
        }),
      ]),
      SITE_2KM,
    );
    expect(
      (next.spec as {layers: Array<{elevationScale: number}>}).layers[0]!
        .elevationScale,
    ).toBeCloseTo(
      (shorterGroundExtentMeters(SITE_2KM) * EXTRUSION_HEIGHT_EXTENT_FRACTION) /
        200,
    );
  });

  test('replaces a 100x elevation on a raw column layer', () => {
    const shorter = shorterGroundExtentMeters(SITE_2KM);
    const next = applyExtrusionScaleToGroundExtent(
      configWith([
        {
          '@@type': 'GeoArrowColumnLayer',
          radius: 50,
          elevationScale: 100,
          getElevation: '@@=count',
        },
      ]),
      SITE_2KM,
    );
    const layer = (next.spec as {layers: Record<string, unknown>[]}).layers[0]!;
    expect(layer.radius).toBe(50);
    expect(layer.elevationScale).not.toBe(100);
    expect(layer.elevationScale).toBeCloseTo(
      (shorter * EXTRUSION_HEIGHT_EXTENT_FRACTION) / 200,
    );
    expect(layer.getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'count',
      range: [0, 200],
    });
    expect(applyExtrusionScaleToGroundExtent(next, SITE_2KM)).toBe(next);
  });

  test('scales a column layer that omits extruded', () => {
    const next = applyExtrusionScaleToGroundExtent(
      configWith([
        {
          '@@type': 'GeoArrowColumnLayer',
          getElevation: scaleElevation(),
          elevationScale: 80,
        },
      ]),
      SITE_2KM,
    );
    expect(
      (next.spec as {layers: Array<{elevationScale: number}>}).layers[0]!
        .elevationScale,
    ).toBeLessThan(10);
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
    const next = applyExtrusionScaleToGroundExtent(input, SITE_2KM);
    expect(next).toBe(input);
  });

  test('does not scale an H3 layer with extrusion turned off', () => {
    const input = configWith([h3Layer({extruded: false})]);
    expect(applyExtrusionScaleToGroundExtent(input, SITE_2KM)).toBe(input);
  });

  test('skips a non-positive elevation range without a stacked multiplier', () => {
    const input = configWith([
      h3Layer({getElevation: scaleElevation(0), elevationScale: 1}),
    ]);
    expect(applyExtrusionScaleToGroundExtent(input, SITE_2KM)).toBe(input);
  });

  test('keeps a manual slider value across a later fit', () => {
    const layer = setManualElevationScale(h3Layer(), 4);
    const input = configWith([layer]);
    const next = applyExtrusionScaleToGroundExtent(input, SITE_2KM);
    expect(next).toBe(input);
    expect(
      (next.spec as {layers: Array<{elevationScale: number}>}).layers[0]!
        .elevationScale,
    ).toBe(4);
  });

  test('is idempotent once the extent scale is stored', () => {
    const once = applyExtrusionScaleToGroundExtent(
      configWith([h3Layer()]),
      SITE_2KM,
    );
    expect(applyExtrusionScaleToGroundExtent(once, SITE_2KM)).toBe(once);
  });

  test('leaves unrelated layers referentially equal', () => {
    const points = {
      '@@type': 'GeoArrowScatterplotLayer',
      getRadius: 4,
    };
    const input = configWith([h3Layer(), points]);
    const next = applyExtrusionScaleToGroundExtent(input, SITE_2KM);
    expect((next.spec as {layers: unknown[]}).layers[1]).toBe(points);
  });

  test('replaces a 100x multiplier on a raw column and on a custom config', () => {
    const raw = applyExtrusionScaleToGroundExtent(
      configWith([
        h3Layer({
          getElevation: '@@=count',
          elevationScale: 100,
        }),
      ]),
      SITE_2KM,
    );
    const rawLayer = (raw.spec as {layers: Record<string, unknown>[]})
      .layers[0]!;
    expect(rawLayer.elevationScale).not.toBe(100);
    expect(rawLayer.getElevation).toMatchObject({
      '@@function': 'scale',
      field: 'count',
      range: [0, 200],
    });
    expect(rawLayer.elevationScale).toBeCloseTo(
      (shorterGroundExtentMeters(SITE_2KM) * EXTRUSION_HEIGHT_EXTENT_FRACTION) /
        200,
    );

    const bare = applyExtrusionScaleToGroundExtent(
      configWith([h3Layer({getElevation: undefined, elevationScale: 100})]),
      SITE_2KM,
    );
    expect(
      (bare.spec as {layers: Array<{elevationScale: number}>}).layers[0]!
        .elevationScale,
    ).toBeCloseTo(
      (shorterGroundExtentMeters(SITE_2KM) * EXTRUSION_HEIGHT_EXTENT_FRACTION) /
        200,
    );

    const custom = applyExtrusionScaleToGroundExtent(
      configWith([h3Layer()], 'custom'),
      SITE_2KM,
    );
    expect(
      (custom.spec as {layers: Array<{elevationScale: number}>}).layers[0]!
        .elevationScale,
    ).toBeCloseTo(
      (shorterGroundExtentMeters(SITE_2KM) * EXTRUSION_HEIGHT_EXTENT_FRACTION) /
        200,
    );
  });

  test('leaves a meter column and a string spec alone', () => {
    const meters = configWith([
      h3Layer({
        getElevation: '@@=height_m',
        elevationScale: 1,
      }),
    ]);
    expect(applyExtrusionScaleToGroundExtent(meters, SITE_2KM)).toBe(meters);

    const stringSpec: DeckMapConfig = {
      spec: '{"layers":[]}',
      datasets: {},
    };
    expect(applyExtrusionScaleToGroundExtent(stringSpec, SITE_2KM)).toBe(
      stringSpec,
    );
  });

  test('returns the same config when bounds are empty', () => {
    const input = configWith([h3Layer()]);
    expect(
      applyExtrusionScaleToGroundExtent(input, [
        [0, 0],
        [0, 0],
      ]),
    ).toBe(input);
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
