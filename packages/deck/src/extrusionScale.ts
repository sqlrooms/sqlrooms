import {
  getDeckMapLayerExtruded,
  type DeckMapLayerRecord,
} from './mapLayerConfigUtils';

/** Meters the settings panel uses as the top of a visual elevation scale. */
const VISUAL_ELEVATION_RANGE_MAX = 200;

/** Meters in one degree of latitude. */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Height of the tallest column as a fraction of the diameter of the circle
 * enclosing the data. A dataset spanning 10km gets 5km of relief.
 */
const EXTRUSION_HEIGHT_EXTENT_FRACTION = 0.5;

/** Longitude/latitude bounding box as `[[west, south], [east, north]]`. */
export type DeckMapGroundBounds = readonly [
  readonly [number, number],
  readonly [number, number],
];

/**
 * `elevationScale` at or above this is an extra multiplier (the assistant's
 * usual 50–100), not a slider tweak around 1.
 */
const STACKED_ELEVATION_SCALE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readElevationScale(layer: DeckMapLayerRecord): number | undefined {
  const value = layer.elevationScale;
  const scale =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : undefined;
  return scale !== undefined && Number.isFinite(scale) ? scale : undefined;
}

function isScaleElevation(
  getElevation: unknown,
): getElevation is Record<string, unknown> {
  if (!isRecord(getElevation)) return false;
  const fn = getElevation['@@function'] ?? getElevation['@@type'];
  return fn === 'scale' || fn === 'scaleLinear';
}

/** Largest positive output of a scale elevation accessor. */
function scaledElevationRangeMax(getElevation: unknown): number | undefined {
  if (!isScaleElevation(getElevation) || !Array.isArray(getElevation.range)) {
    return undefined;
  }
  const max = Math.max(
    Number(getElevation.range[0]),
    Number(getElevation.range[1]),
  );
  return max > 0 && Number.isFinite(max) ? max : undefined;
}

function visualElevation(field: string): Record<string, unknown> {
  return {
    '@@function': 'scale',
    field,
    type: 'linear',
    domain: 'auto',
    range: [0, VISUAL_ELEVATION_RANGE_MAX],
  };
}

/**
 * Removes an assistant `elevationScale` of 10 or more.
 *
 * The multiplier is deleted so {@link sizeDeckMapExtrusionToExtent} can size
 * the layer instead, and `@@=column` becomes a scale it can size. A constant
 * height and a real meter column (`elevationScale` omitted or near 1) stay as
 * they are.
 */
export function relaxStackedElevationScale(
  layer: DeckMapLayerRecord,
): DeckMapLayerRecord {
  if (!getDeckMapLayerExtruded(layer)) return layer;
  const scale = readElevationScale(layer);
  if (scale === undefined || scale < STACKED_ELEVATION_SCALE) return layer;

  const next: DeckMapLayerRecord = {...layer};
  delete next.elevationScale;
  if (scaledElevationRangeMax(layer.getElevation) !== undefined) return next;

  const elevation = layer.getElevation;
  if (typeof elevation === 'string') {
    const field = /^@@=([A-Za-z_]\w*)$/.exec(elevation.trim())?.[1];
    if (field) next.getElevation = visualElevation(field);
  } else if (isScaleElevation(elevation)) {
    next.getElevation = {
      domain: 'auto',
      type: 'linear',
      ...elevation,
      range: [0, VISUAL_ELEVATION_RANGE_MAX],
    };
  }
  return next;
}

/** Diameter in meters of the circle enclosing a longitude/latitude box. */
function groundDiameterMeters(bounds: DeckMapGroundBounds): number {
  const [[west, south], [east, north]] = bounds;
  const lonSpan = Math.abs(east - west);
  // Data straddling the antimeridian reports a span of nearly 360 degrees.
  const lonDegrees = lonSpan > 180 ? 360 - lonSpan : lonSpan;
  const midLat = (south + north) / 2;
  const width =
    lonDegrees * METERS_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180);
  const height = Math.abs(north - south) * METERS_PER_DEGREE_LAT;
  return Math.hypot(width, height);
}

/**
 * Scales extruded layers so the top of a visual elevation scale reaches
 * {@link EXTRUSION_HEIGHT_EXTENT_FRACTION} of the data's ground extent,
 * keeping height differences readable at any zoom.
 *
 * This derives the rendered spec and never rewrites the stored config. A
 * layer's own `elevationScale` stays in effect as a multiplier on top, so the
 * extrusion slider still overrides the normalized height. Layers whose
 * elevation is already in real meters (`@@=column` or a constant) are left
 * alone.
 *
 * @param spec - Deck JSON spec, or a serialized spec which is returned as is.
 * @param bounds - Fitted data bounds, or null before a fit has run.
 * @returns The spec, or the same reference when no layer changes.
 */
export function sizeDeckMapExtrusionToExtent(
  spec: string | Record<string, unknown>,
  bounds: DeckMapGroundBounds | null | undefined,
): string | Record<string, unknown> {
  if (!bounds || !isRecord(spec) || !Array.isArray(spec.layers)) return spec;
  const diameter = groundDiameterMeters(bounds);
  if (!Number.isFinite(diameter) || diameter <= 0) return spec;
  const targetHeight = diameter * EXTRUSION_HEIGHT_EXTENT_FRACTION;

  let changed = false;
  const layers = spec.layers.map((layer) => {
    if (!isRecord(layer) || !getDeckMapLayerExtruded(layer)) return layer;
    const rangeMax = scaledElevationRangeMax(layer.getElevation);
    if (rangeMax === undefined) return layer;
    const elevationScale =
      (targetHeight / rangeMax) * (readElevationScale(layer) ?? 1);
    if (elevationScale === layer.elevationScale) return layer;
    changed = true;
    return {...layer, elevationScale};
  });
  return changed ? {...spec, layers} : spec;
}
