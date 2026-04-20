import type {ColorScaleConfig} from '@sqlrooms/color-scales';
import {isSqlroomsColorScaleFunction} from './layerConfig';

const SQLROOMS_COLOR_SCALE_MARKER = Symbol.for(
  '@sqlrooms/deck/sqlrooms-color-scale',
);

export type SqlroomsColorScaleMarker = {
  colorScale: ColorScaleConfig;
  [SQLROOMS_COLOR_SCALE_MARKER]: true;
};

export function createSqlroomsColorScaleMarker(
  value: ColorScaleConfig,
): SqlroomsColorScaleMarker {
  return {
    colorScale: value,
    [SQLROOMS_COLOR_SCALE_MARKER]: true,
  };
}

export function isSqlroomsColorScaleMarker(
  value: unknown,
): value is SqlroomsColorScaleMarker {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as {[SQLROOMS_COLOR_SCALE_MARKER]?: boolean})[
      SQLROOMS_COLOR_SCALE_MARKER
    ],
  );
}

export function getSqlroomsColorScale(
  props: Record<string, unknown>,
):
  | {propName: 'getFillColor' | 'getLineColor'; colorScale: ColorScaleConfig}
  | undefined {
  for (const propName of ['getFillColor', 'getLineColor'] as const) {
    const value = props[propName];
    if (isSqlroomsColorScaleMarker(value)) {
      return {
        propName,
        colorScale: value.colorScale,
      };
    }
    if (isSqlroomsColorScaleFunction(value)) {
      return {
        propName,
        colorScale: value,
      };
    }
  }

  return undefined;
}
