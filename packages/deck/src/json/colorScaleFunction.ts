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

export type ColorScalePropName =
  | 'getFillColor'
  | 'getLineColor'
  | 'getColor'
  | 'getSourceColor'
  | 'getTargetColor';

export function getColorScale(props: Record<string, unknown>):
  | {
      propName: ColorScalePropName;
      colorScale: ColorScaleConfig;
    }
  | undefined {
  const all = getAllColorScales(props);
  return all.length > 0 ? all[0] : undefined;
}

export function getAllColorScales(props: Record<string, unknown>): Array<{
  propName: ColorScalePropName;
  colorScale: ColorScaleConfig;
}> {
  const results: Array<{
    propName: ColorScalePropName;
    colorScale: ColorScaleConfig;
  }> = [];

  for (const propName of [
    'getFillColor',
    'getLineColor',
    'getColor',
    'getSourceColor',
    'getTargetColor',
  ] as const) {
    const value = props[propName];
    if (isColorScaleMarker(value)) {
      results.push({propName, colorScale: value.colorScale});
    } else if (isColorScaleFunction(value)) {
      results.push({propName, colorScale: value});
    }
  }

  return results;
}
