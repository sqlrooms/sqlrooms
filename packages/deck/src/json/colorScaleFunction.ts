import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {isColorScaleFunction} from './layerConfig';

const SQLROOMS_COLOR_SCALE_MARKER = Symbol.for(
  '@sqlrooms/deck/sqlrooms-color-scale',
);

export type ColorScaleMarker = {
  colorScale: ColorScaleConfig;
  [SQLROOMS_COLOR_SCALE_MARKER]: true;
};

export function createColorScaleMarker(
  value: ColorScaleConfig,
): ColorScaleMarker {
  return {
    colorScale: value,
    [SQLROOMS_COLOR_SCALE_MARKER]: true,
  };
}

export function isColorScaleMarker(value: unknown): value is ColorScaleMarker {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as {[SQLROOMS_COLOR_SCALE_MARKER]?: boolean})[
      SQLROOMS_COLOR_SCALE_MARKER
    ] &&
    typeof (value as {colorScale?: unknown}).colorScale === 'object' &&
    (value as {colorScale?: unknown}).colorScale != null,
  );
}

/** Names of layer accessor props that can carry a color scale. */
export type ColorScalePropName =
  | 'getFillColor'
  | 'getLineColor'
  | 'getColor'
  | 'getSourceColor'
  | 'getTargetColor';

/** All known color accessor prop names. */
export const COLOR_SCALE_PROP_NAMES: readonly ColorScalePropName[] = [
  'getFillColor',
  'getLineColor',
  'getColor',
  'getSourceColor',
  'getTargetColor',
];

/**
 * Returns the first color scale entry found on the layer props, if any.
 * Prefer {@link getAllColorScales} when a layer may define multiple color scale accessors.
 */
export function getColorScale(props: Record<string, unknown>):
  | {
      propName: ColorScalePropName;
      colorScale: ColorScaleConfig;
    }
  | undefined {
  const all = getAllColorScales(props);
  return all.length > 0 ? all[0] : undefined;
}

/** Returns every color scale entry found across all known accessor props on the layer. */
export function getAllColorScales(props: Record<string, unknown>): Array<{
  propName: ColorScalePropName;
  colorScale: ColorScaleConfig;
}> {
  const results: Array<{
    propName: ColorScalePropName;
    colorScale: ColorScaleConfig;
  }> = [];

  for (const propName of COLOR_SCALE_PROP_NAMES) {
    const value = props[propName];
    if (isColorScaleMarker(value)) {
      results.push({propName, colorScale: value.colorScale});
    } else if (isColorScaleFunction(value)) {
      results.push({propName, colorScale: value});
    }
  }

  return results;
}
