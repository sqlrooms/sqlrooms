import type {DeckMapConfig} from './mapConfig';
import {
  getDeckMapLayerExtruded,
  usesColumnRadiusSetting,
  type DeckMapLayerRecord,
} from './mapLayerConfigUtils';

/** Meters the settings panel uses as the top of a visual elevation scale. */
const VISUAL_ELEVATION_RANGE_MAX = 200;

/**
 * `elevationScale` at or above this is an extra multiplier (the assistant's
 * usual 50–100), not a slider tweak around 1.
 */
const STACKED_ELEVATION_SCALE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isManualElevationScale(layer: DeckMapLayerRecord): boolean {
  const binding = layer._sqlroomsBinding;
  return Boolean(isRecord(binding) && binding.elevationScaleManual === true);
}

/**
 * Records a slider edit so a later fit does not remove `elevationScale`.
 */
export function setManualElevationScale(
  layer: DeckMapLayerRecord,
  elevationScale: number,
): DeckMapLayerRecord {
  const binding = isRecord(layer._sqlroomsBinding)
    ? layer._sqlroomsBinding
    : {};
  return {
    ...layer,
    elevationScale,
    _sqlroomsBinding: {
      ...binding,
      elevationScaleManual: true,
    },
  };
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
 * A scale range is already meters, so the extra multiplier is deleted.
 * `@@=column` and a missing elevation become a 0–200m scale. Real meter
 * columns (`elevationScale` omitted or near 1) stay as they are.
 */
export function relaxStackedElevationScale(
  layer: DeckMapLayerRecord,
): DeckMapLayerRecord {
  // Column layers keep their elevationScale. Stripping it leaves a short
  // stub that reads as a flat disk. H3 and extruded polygons are the case
  // where an extra multiplier covers the map.
  if (
    isManualElevationScale(layer) ||
    !getDeckMapLayerExtruded(layer) ||
    usesColumnRadiusSetting(layer['@@type'])
  ) {
    return layer;
  }
  const scale = readElevationScale(layer);
  if (scale === undefined || scale < STACKED_ELEVATION_SCALE) return layer;

  const next: DeckMapLayerRecord = {...layer};
  delete next.elevationScale;
  if (scaledElevationRangeMax(layer.getElevation) !== undefined) return next;

  const elevation = layer.getElevation;
  if (typeof elevation === 'string') {
    const field = /^@@=([A-Za-z_]\w*)$/.exec(elevation.trim())?.[1];
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
  if (!isRecord(elevation)) next.getElevation = VISUAL_ELEVATION_RANGE_MAX;
  return next;
}

/**
 * Removes stacked elevation multipliers from extruded layers.
 * Returns the same config when nothing changes.
 */
export function relaxDeckMapElevation(config: DeckMapConfig): DeckMapConfig {
  if (!isRecord(config.spec) || !Array.isArray(config.spec.layers)) {
    return config;
  }
  let changed = false;
  const layers = config.spec.layers.map((layer) => {
    if (!isRecord(layer)) return layer;
    const next = relaxStackedElevationScale(layer);
    if (next !== layer) changed = true;
    return next;
  });
  return changed ? {...config, spec: {...config.spec, layers}} : config;
}
