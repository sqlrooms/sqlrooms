import type {DeckMapConfig} from './mapConfig';
import {
  getDeckMapLayerExtruded,
  usesColumnRadiusSetting,
  type DeckMapLayerRecord,
} from './mapLayerConfigUtils';

/**
 * Tallest extruded column, as a fraction of the shorter ground side.
 * About 12% stays inside a pitched fit-to-data view instead of filling it.
 */
export const EXTRUSION_HEIGHT_EXTENT_FRACTION = 0.12;

/**
 * Column disk radius, as a fraction of the shorter ground side.
 * About 2% stays narrower than the extruded height so disks do not cover a small site.
 */
export const COLUMN_RADIUS_EXTENT_FRACTION = 0.02;

const METERS_PER_DEGREE_LAT = 111_320;

/** `[[minLon, minLat], [maxLon, maxLat]]`, the same shape fit-to-data returns. */
export type GroundExtentBounds = readonly [
  readonly [number, number],
  readonly [number, number],
];

/**
 * Shorter side of a lon/lat bounding box, in meters.
 * Longitude is scaled by the cosine of the mid-latitude.
 *
 * @returns `0` when the box is empty or the coordinates are not finite.
 */
export function shorterGroundExtentMeters(bounds: GroundExtentBounds): number {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  if (
    ![minLon, minLat, maxLon, maxLat].every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    return 0;
  }
  const midLat = (minLat + maxLat) / 2;
  const heightMeters = Math.abs(maxLat - minLat) * METERS_PER_DEGREE_LAT;
  const widthMeters =
    Math.abs(maxLon - minLon) *
    METERS_PER_DEGREE_LAT *
    Math.cos((midLat * Math.PI) / 180);
  return Math.min(heightMeters, Math.abs(widthMeters));
}

/**
 * Column radius in meters, capped so a disk is
 * {@link COLUMN_RADIUS_EXTENT_FRACTION} of the shorter ground side.
 *
 * @param radiusMeters - Authored radius. Missing or non-positive becomes the cap.
 * @returns `undefined` when the extent cannot produce a positive radius.
 */
export function columnRadiusForGroundExtent(
  bounds: GroundExtentBounds,
  radiusMeters?: number,
): number | undefined {
  const shorter = shorterGroundExtentMeters(bounds);
  if (!(shorter > 0)) return undefined;
  const cap = shorter * COLUMN_RADIUS_EXTENT_FRACTION;
  if (!Number.isFinite(cap) || !(cap > 0)) return undefined;
  if (radiusMeters === undefined || !(radiusMeters > 0)) return cap;
  return Math.min(radiusMeters, cap);
}

/**
 * `elevationScale` that makes a scaled `getElevation` peak at
 * {@link EXTRUSION_HEIGHT_EXTENT_FRACTION} of the shorter ground side.
 *
 * Deck.gl draws `getElevation * elevationScale` meters. A scale range of
 * `[0, 200]` is already meters, so the returned scale is
 * `targetMeters / rangeMax`, not an extra exaggeration on top of a large value.
 *
 * @param elevationRangeMax - Largest value the elevation accessor returns.
 * @returns `undefined` when the extent or range cannot produce a positive scale.
 */
export function elevationScaleForGroundExtent(
  bounds: GroundExtentBounds,
  elevationRangeMax: number,
): number | undefined {
  if (!(elevationRangeMax > 0) || !Number.isFinite(elevationRangeMax)) {
    return undefined;
  }
  const shorter = shorterGroundExtentMeters(bounds);
  if (!(shorter > 0)) return undefined;
  const scale =
    (shorter * EXTRUSION_HEIGHT_EXTENT_FRACTION) / elevationRangeMax;
  if (!Number.isFinite(scale) || !(scale > 0)) return undefined;
  return scale;
}

/**
 * Records a slider edit so a later fit does not replace `elevationScale`.
 */
export function setManualElevationScale(
  layer: DeckMapLayerRecord,
  elevationScale: number,
): DeckMapLayerRecord {
  const binding = layer._sqlroomsBinding;
  const bindingRecord =
    binding && typeof binding === 'object' && !Array.isArray(binding)
      ? (binding as Record<string, unknown>)
      : {};
  return {
    ...layer,
    elevationScale,
    _sqlroomsBinding: {
      ...bindingRecord,
      elevationScaleManual: true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isManualElevationScale(layer: DeckMapLayerRecord): boolean {
  const binding = layer._sqlroomsBinding;
  return Boolean(isRecord(binding) && binding.elevationScaleManual === true);
}

function isManualColumnRadius(layer: DeckMapLayerRecord): boolean {
  const binding = layer._sqlroomsBinding;
  return Boolean(isRecord(binding) && binding.radiusManual === true);
}

/** Meters the settings panel uses as the top of a visual elevation scale. */
const VISUAL_ELEVATION_RANGE_MAX = 200;

/**
 * `elevationScale` at or above this is an extra multiplier (the assistant's
 * usual 50–100), not a slider tweak around 1.
 */
const STACKED_ELEVATION_SCALE = 10;

const COLUMN_ELEVATION = /^@@=([A-Za-z_][\w]*)$/;

function isScaleElevation(
  getElevation: unknown,
): getElevation is Record<string, unknown> {
  if (!isRecord(getElevation)) return false;
  const fn = getElevation['@@function'] ?? getElevation['@@type'];
  return fn === 'scale' || fn === 'scaleLinear';
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

/** Largest positive output of a scale elevation accessor. */
function scaledElevationRangeMax(getElevation: unknown): number | undefined {
  if (!isScaleElevation(getElevation)) return undefined;
  const range = getElevation.range;
  if (!Array.isArray(range) || range.length < 2) return undefined;
  const r0 = range[0];
  const r1 = range[1];
  if (typeof r0 !== 'number' || typeof r1 !== 'number') return undefined;
  if (!Number.isFinite(r0) || !Number.isFinite(r1)) return undefined;
  const max = Math.max(r0, r1);
  return max > 0 ? max : undefined;
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

/**
 * Turns an assistant `elevationScale` of 10+ into a visual scale the fit path
 * can size. A scale range that already exists is left for the caller to
 * rescale. `@@=column` and a missing elevation become a 0–200m scale.
 * Real meter columns (`elevationScale` omitted or near 1) stay as they are.
 */
export function relaxStackedElevationScale(
  layer: DeckMapLayerRecord,
): DeckMapLayerRecord {
  if (isManualElevationScale(layer) || !getDeckMapLayerExtruded(layer)) {
    return layer;
  }
  const scale = readElevationScale(layer);
  if (scale === undefined || scale < STACKED_ELEVATION_SCALE) return layer;
  if (scaledElevationRangeMax(layer.getElevation) !== undefined) return layer;

  const elevation = layer.getElevation;
  const next: DeckMapLayerRecord = {...layer};
  delete next.elevationScale;

  if (typeof elevation === 'string') {
    const field = elevation.trim().match(COLUMN_ELEVATION)?.[1];
    if (field) next.getElevation = visualElevation(field);
    return next;
  }

  if (isScaleElevation(elevation)) {
    next.getElevation = {
      ...elevation,
      '@@function': 'scale',
      type:
        elevation.type === 'linear' || elevation.type === undefined
          ? 'linear'
          : elevation.type,
      domain: elevation.domain ?? 'auto',
      range: [0, VISUAL_ELEVATION_RANGE_MAX],
    };
    return next;
  }

  if (!isRecord(elevation)) {
    next.getElevation = VISUAL_ELEVATION_RANGE_MAX;
  }
  return next;
}

function nearlyEqual(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    1e-9 * Math.max(1, Math.abs(left), Math.abs(right))
  );
}

/**
 * Rewrites `elevationScale` on extruded layers so the tallest column tracks
 * the fitted ground extent.
 *
 * A stacked multiplier (`elevationScale` of 10 or more, including on a raw
 * `@@=column`) is replaced. Column disk radius is capped to
 * {@link COLUMN_RADIUS_EXTENT_FRACTION} of the same extent.
 * Layers marked with `elevationScaleManual` or `radiusManual` keep that edit.
 * Raw meter columns with no extra multiplier stay as they are.
 * Returns the same config when nothing changes.
 */
export function applyExtrusionScaleToGroundExtent(
  config: DeckMapConfig,
  bounds: GroundExtentBounds,
): DeckMapConfig {
  if (!isRecord(config.spec)) return config;
  const layers = config.spec.layers;
  if (!Array.isArray(layers)) return config;

  let changed = false;
  const nextLayers = layers.map((layer) => {
    if (!isRecord(layer)) return layer;
    let next = relaxStackedElevationScale(layer);
    let layerChanged = next !== layer;

    if (!isManualElevationScale(next) && getDeckMapLayerExtruded(next)) {
      const rangeMax =
        scaledElevationRangeMax(next.getElevation) ??
        (next !== layer &&
        typeof next.getElevation === 'number' &&
        next.getElevation > 0
          ? next.getElevation
          : undefined);
      if (rangeMax !== undefined) {
        const scale = elevationScaleForGroundExtent(bounds, rangeMax);
        if (
          scale !== undefined &&
          !(
            typeof next.elevationScale === 'number' &&
            nearlyEqual(next.elevationScale, scale)
          )
        ) {
          next = {...next, elevationScale: scale};
          layerChanged = true;
        }
      }
    }

    if (
      usesColumnRadiusSetting(next['@@type']) &&
      !isManualColumnRadius(next)
    ) {
      const authored =
        typeof next.radius === 'number' && next.radius > 0
          ? next.radius
          : undefined;
      const radius = columnRadiusForGroundExtent(bounds, authored);
      if (
        radius !== undefined &&
        !(typeof next.radius === 'number' && nearlyEqual(next.radius, radius))
      ) {
        next = {...next, radius, radiusUnits: 'meters'};
        layerChanged = true;
      }
    }

    if (layerChanged) changed = true;
    return layerChanged ? next : layer;
  });

  if (!changed) return config;
  return {
    ...config,
    spec: {
      ...config.spec,
      layers: nextLayers,
    },
  };
}
