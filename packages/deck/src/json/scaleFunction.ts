import type * as arrow from 'apache-arrow';
import {isBindableGeoArrowFieldIdentifier} from './compileGeoArrowAccessor';

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
    // Arrow/SQL NULL must not become 0 via Number(null).
    if (typeof vector.isValid === 'function' && !vector.isValid(i)) {
      continue;
    }
    const raw = vector.get(i);
    if (raw == null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return [min, max];
}

/**
 * Linear scale `@@=` expression. Non-identifier fields need
 * {@link compileLinearScaleAccessor}.
 */
export function compileLinearScaleExpression(
  table: arrow.Table,
  scale: LinearScaleConfig,
): string | undefined {
  const field = scale.field.trim();
  if (!field || !isBindableGeoArrowFieldIdentifier(field)) return undefined;

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
  // Clamp after linear map (bigint coercion lives in compileGeoArrowAccessor).
  return `@@=Math.max(${lo}, Math.min(${hi}, ${r0} + (${field} - ${d0}) / ${span} * ${r1 - r0}))`;
}

function readLinearScaleRawValue(
  value: unknown,
  field: string,
  vector: arrow.Vector,
): unknown {
  if (!value || typeof value !== 'object') return undefined;

  const object = value as {
    index?: unknown;
    data?: {data?: {getChild?: (name: string) => arrow.Vector | null}};
    properties?: Record<string, unknown>;
  };

  if (typeof object.index === 'number') {
    const batch = object.data?.data;
    if (batch?.getChild) {
      return batch.getChild(field)?.get(object.index);
    }
    if (batch) {
      // Batch-local index (GeoArrow) without this field — do not fall back to
      // the table-level vector.
      return undefined;
    }
    return vector.get(object.index);
  }

  const sources = [object.properties, object as Record<string, unknown>];
  for (const source of sources) {
    if (source && typeof source === 'object' && field in source) {
      return source[field];
    }
  }

  return undefined;
}

/**
 * Elevation accessor for any Arrow column name (incl. non-identifiers).
 * Reads GeoArrow `{index, data}` callbacks or GeoJSON `{properties}` features.
 */
export function compileLinearScaleAccessor(
  table: arrow.Table,
  scale: LinearScaleConfig,
): ((value: unknown) => number) | undefined {
  const field = scale.field.trim();
  if (!field) return undefined;

  const vector = table.getChild(field);
  if (!vector) return undefined;

  const domain =
    scale.domain === 'auto' || scale.domain === undefined
      ? readNumericDomain(vector)
      : scale.domain;
  if (!domain) return undefined;

  const [d0, d1] = domain;
  const range = scale.range;

  return (value) => {
    const raw = readLinearScaleRawValue(value, field, vector);
    if (raw == null) return 0;
    const v = Number(raw);
    if (!Number.isFinite(v)) return 0;

    if (!range) {
      return Math.max(0, v - d0);
    }

    const [r0, r1] = range;
    const span = d1 - d0;
    if (span === 0) return r0;
    const lo = Math.min(r0, r1);
    const hi = Math.max(r0, r1);
    return Math.max(lo, Math.min(hi, r0 + ((v - d0) / span) * (r1 - r0)));
  };
}
