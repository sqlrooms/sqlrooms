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
    ],
  );
}

export function getColorScale(
  props: Record<string, unknown>,
):
  | {propName: 'getFillColor' | 'getLineColor'; colorScale: ColorScaleConfig}
  | undefined {
  for (const propName of ['getFillColor', 'getLineColor'] as const) {
    const value = props[propName];
    if (isColorScaleMarker(value)) {
      return {
        propName,
        colorScale: value.colorScale,
      };
    }
    if (isColorScaleFunction(value)) {
      return {
        propName,
        colorScale: value,
      };
    }
  }

  return undefined;
}
