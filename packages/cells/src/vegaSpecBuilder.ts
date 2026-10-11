import {BRUSH_PARAM_NAME} from './vegaSelectionUtils';
import type {BrushFieldType} from './types';

/**
 * Read the flat encoding/mark values from either a flat spec or a
 * dual-layer cross-filter spec so the config panel dropdowns reflect
 * the current state regardless of spec shape.
 */
export function readSpecValues(spec: any): {
  mark: string | undefined;
  xField: string | undefined;
  yField: string | undefined;
  yAggregate: string | undefined;
  color: string | undefined;
} {
  if (spec?.layer && Array.isArray(spec.layer)) {
    const fg = spec.layer[1] ?? spec.layer[0];
    const bg = spec.layer[0];
    return {
      mark: fg?.mark ?? bg?.mark,
      xField: fg?.encoding?.x?.field ?? bg?.encoding?.x?.field,
      yField: fg?.encoding?.y?.field ?? bg?.encoding?.y?.field,
      yAggregate: fg?.encoding?.y?.aggregate ?? bg?.encoding?.y?.aggregate,
      color: fg?.encoding?.color?.value,
    };
  }
  return {
    mark: spec?.mark,
    xField: spec?.encoding?.x?.field,
    yField: spec?.encoding?.y?.field,
    yAggregate: spec?.encoding?.y?.aggregate,
    color: spec?.encoding?.color?.value,
  };
}

/**
 * Build a dual-layer Vega-Lite spec with a brush selection param on the
 * background layer and a filter transform on the foreground layer.
 */
export function buildCrossFilterSpec(opts: {
  mark: string;
  xField?: string;
  xFieldType?: BrushFieldType;
  yField?: string;
  yAggregate?: string;
  color?: string;
}): any {
  const {mark, xField, xFieldType, yField, yAggregate, color} = opts;
  const xEnc: any = xField
    ? {
        field: xField,
        ...(xFieldType === 'numeric' ? {bin: {maxbins: 20}} : {}),
      }
    : undefined;
  const yEnc: any = yField
    ? {field: yField, aggregate: yAggregate ?? 'sum'}
    : yAggregate === 'count'
      ? {aggregate: 'count'}
      : undefined;

  const encoding: any = {};
  if (xEnc) encoding.x = xEnc;
  if (yEnc) encoding.y = yEnc;

  return {
    layer: [
      {
        params: [
          {
            name: BRUSH_PARAM_NAME,
            select: {type: 'interval', encodings: ['x']},
          },
        ],
        mark,
        encoding: {
          ...encoding,
          color: {value: '#ddd'},
        },
      },
      {
        transform: [{filter: {param: BRUSH_PARAM_NAME}}],
        mark,
        encoding: {
          ...encoding,
          ...(color ? {color: {value: color}} : {}),
        },
      },
    ],
    padding: 20,
  };
}

/** Build a simple flat spec (no cross-filtering). */
export function buildFlatSpec(opts: {
  mark: string;
  xField?: string;
  yField?: string;
  yAggregate?: string;
  color?: string;
}): any {
  const {mark, xField, yField, yAggregate, color} = opts;
  const encoding: any = {};
  if (xField) encoding.x = {field: xField};
  if (yField) encoding.y = {field: yField, aggregate: yAggregate ?? 'sum'};
  else if (yAggregate === 'count') encoding.y = {aggregate: 'count'};
  if (color) encoding.color = {value: color};
  return {mark, encoding, padding: 20};
}
