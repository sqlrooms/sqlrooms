import {BRUSH_PARAM_NAME} from './vegaSelectionUtils';
import type {BrushFieldType, TimeScale} from './types';

/**
 * Get Vega-Lite axis format string for a given time scale.
 */
function getTemporalAxisFormat(timeScale: string): string {
  switch (timeScale) {
    case 'year':
      return '%Y';
    case 'month':
      return '%Y-%m';
    case 'day':
      return '%Y-%m-%d';
    case 'hour':
      return '%Y-%m-%d %H:00';
    case 'minute':
      return '%Y-%m-%d %H:%M';
    default:
      return '%Y-%m-%d';
  }
}

/**
 * Get Vega-Lite encoding properties for a field type.
 * Returns type and scale configuration to ensure proper interval selection behavior.
 */
function getFieldTypeEncoding(fieldType: BrushFieldType | undefined): any {
  switch (fieldType) {
    case 'temporal':
      return {type: 'temporal', scale: {type: 'time'}};
    case 'numeric':
      return {type: 'quantitative'};
    case 'boolean':
      return {type: 'quantitative'}; // Booleans map to 0/1
    default:
      return {}; // String, null, or undefined - no explicit type
  }
}

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
  xTimeScale?: TimeScale;
  yField?: string;
  yAggregate?: string;
  color?: string;
}): any {
  const {mark, xField, xFieldType, xTimeScale, yField, yAggregate, color} =
    opts;
  const isDateTimeBinned = xTimeScale && xTimeScale !== 'none';
  const xEnc: any = xField
    ? {
        field: xField,
        // Set explicit type for all field types using helper
        ...getFieldTypeEncoding(xFieldType),
        // Apply Vega-side binning only for numeric fields
        ...(xFieldType === 'numeric' && !isDateTimeBinned
          ? {bin: {maxbins: 20}}
          : {}),
        // Apply axis format only when datetime is SQL-binned
        ...(isDateTimeBinned
          ? {axis: {format: getTemporalAxisFormat(xTimeScale)}}
          : {}),
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

  // Build data spec with format for parsing ISO date strings from SQL
  const dataSpec: any = {name: 'queryResult'};
  // Parse ALL temporal fields as dates (not just binned ones)
  if (xField && xFieldType === 'temporal') {
    dataSpec.format = {
      parse: {
        [xField]: 'date',
      },
    };
  }

  // Use point selection for strings (categorical data), interval for numeric/temporal
  const selectionType =
    xFieldType === 'string'
      ? {type: 'point' as const, on: 'click', toggle: true, encodings: ['x']}
      : {type: 'interval' as const, encodings: ['x']};

  return {
    data: dataSpec,
    width: 'container',
    height: 'container',
    layer: [
      {
        params: [
          {
            name: BRUSH_PARAM_NAME,
            select: selectionType,
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
  xFieldType?: BrushFieldType;
  xTimeScale?: TimeScale;
  yField?: string;
  yAggregate?: string;
  color?: string;
}): any {
  const {mark, xField, xFieldType, xTimeScale, yField, yAggregate, color} =
    opts;
  const isDateTimeBinned = xTimeScale && xTimeScale !== 'none';
  const encoding: any = {};
  if (xField) {
    encoding.x = {
      field: xField,
      // Use helper function for explicit types
      ...getFieldTypeEncoding(xFieldType),
      // Apply axis format only when SQL-binned
      ...(isDateTimeBinned
        ? {axis: {format: getTemporalAxisFormat(xTimeScale)}}
        : {}),
    };
  }
  if (yField) encoding.y = {field: yField, aggregate: yAggregate ?? 'sum'};
  else if (yAggregate === 'count') encoding.y = {aggregate: 'count'};
  if (color) encoding.color = {value: color};

  // Build data spec with format for parsing ISO date strings from SQL
  const dataSpec: any = {name: 'queryResult'};
  // Parse ALL temporal fields as dates (not just binned ones)
  if (xField && xFieldType === 'temporal') {
    dataSpec.format = {
      parse: {
        [xField]: 'date',
      },
    };
  }

  return {
    data: dataSpec,
    width: 'container',
    height: 'container',
    mark,
    encoding,
    padding: 20,
  };
}
