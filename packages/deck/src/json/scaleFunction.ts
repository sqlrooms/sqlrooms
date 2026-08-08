import type * as arrow from 'apache-arrow';

const SQLROOMS_SCALE_MARKER = Symbol.for('@sqlrooms/deck/sqlrooms-scale');

export type LinearScaleConfig = {
  field: string;
  type?: 'linear';
  domain?: 'auto' | [number, number];
  /** When set, map domain → range. When omitted, use raw field minus domain min. */
  range?: [number, number];
};

export type ScaleMarker = LinearScaleConfig & {
  [SQLROOMS_SCALE_MARKER]: true;
};

/** Marker returned by the Deck JSON `scale` function before table-aware compile. */
export function createScaleMarker(
  props: Record<string, unknown>,
): ScaleMarker | undefined {
  const field = typeof props.field === 'string' ? props.field.trim() : '';
  if (!field) return undefined;

  const domain =
    props.domain === 'auto'
      ? 'auto'
      : Array.isArray(props.domain) &&
          props.domain.length === 2 &&
          typeof props.domain[0] === 'number' &&
          typeof props.domain[1] === 'number'
        ? ([props.domain[0], props.domain[1]] as [number, number])
        : 'auto';

  const range =
    Array.isArray(props.range) &&
    props.range.length === 2 &&
    typeof props.range[0] === 'number' &&
    typeof props.range[1] === 'number'
      ? ([props.range[0], props.range[1]] as [number, number])
      : undefined;

  return {
    [SQLROOMS_SCALE_MARKER]: true,
    field,
    type: 'linear',
    domain,
    ...(range ? {range} : {}),
  };
}

export function isScaleMarker(value: unknown): value is ScaleMarker {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as {[SQLROOMS_SCALE_MARKER]?: boolean})[SQLROOMS_SCALE_MARKER],
  );
}

function readNumericDomain(vector: arrow.Vector): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vector.length; i++) {
    const v = Number(vector.get(i));
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
}

/**
 * Build a GeoArrow `@@=` expression for elevation-style linear scales.
 *
 * - With `range`: map domain → range (UI extrusion: typically `[0, 200]` meters).
 * - Without `range`: legacy behavior — raw field minus domain minimum.
 */
export function compileLinearScaleExpression(
  table: arrow.Table,
  scale: LinearScaleConfig,
): string | undefined {
  const field = scale.field.trim();
  if (!field || !/^[A-Za-z_$][\w$]*$/.test(field)) return undefined;

  const vector = table.getChild(field);
  if (!vector) return undefined;

  const domain =
    scale.domain === 'auto' || scale.domain === undefined
      ? readNumericDomain(vector)
      : scale.domain;
  if (!domain) return undefined;

  const [d0, d1] = domain;

  if (!scale.range) {
    if (d0 === 0) return `@@=${field}`;
    return `@@=Math.max(0, ${field} - ${d0})`;
  }

  const [r0, r1] = scale.range;
  const span = d1 - d0;
  if (span === 0) {
    return `@@=${r0}`;
  }

  const lo = Math.min(r0, r1);
  const hi = Math.max(r0, r1);
  // Clamp to range after linear map. Field values are coerced from bigint in
  // compileGeoArrowAccessor.
  return `@@=Math.max(${lo}, Math.min(${hi}, ${r0} + (${field} - ${d0}) / ${span} * ${r1 - r0}))`;
}
