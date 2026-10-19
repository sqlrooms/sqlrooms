import {DataType, TimeUnit, type Data, type Vector} from 'apache-arrow';

/**
 * How raw trip timestamps are mapped into the Float32 range TripsLayer can
 * animate. `origin` and `divisor` are applied as `(value - origin) / divisor`.
 */
export type TripTimestampNormalization = {
  origin: number;
  divisor: number;
  /** Largest normalized timestamp. This is the animation length. */
  max: number;
};

/**
 * Values at or above this are epoch-scale (unix seconds and up). The animation
 * clock starts at 0, so leaving them absolute means the playhead never reaches
 * the data.
 */
const EPOCH_REBASE_MIN = 1e8;

/** Epoch milliseconds, or Arrow timestamps already converted to milliseconds. */
const EPOCH_MILLISECOND_ABS = 1e11;

/** Raw microseconds that were not a Timestamp type (Arrow would already be ms). */
const EPOCH_MICROSECOND_ABS = 1e14;

/**
 * Read one timestamp child value as milliseconds when the child is an Arrow
 * timestamp, matching `Vector.get`. Other numeric children are returned as
 * stored.
 */
export function readTripTimestampValue(child: Data, index: number): number {
  const raw = child.values?.[index];
  if (typeof raw === 'bigint') {
    return timestampToMilliseconds(child, Number(raw));
  }
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return NaN;
  return timestampToMilliseconds(child, numeric);
}

function timestampToMilliseconds(child: Data, value: number): number {
  if (!DataType.isTimestamp(child.type)) return value;
  switch (child.type.unit) {
    case TimeUnit.SECOND:
      return value * 1000;
    case TimeUnit.MILLISECOND:
      return value;
    case TimeUnit.MICROSECOND:
      return value / 1000;
    case TimeUnit.NANOSECOND:
      return value / 1_000_000;
    default:
      return value;
  }
}

/** Map a min/max pair onto a Float32-safe range that starts near 0. */
export function planTripTimestampNormalization(
  min: number,
  max: number,
): TripTimestampNormalization | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  const origin = min >= EPOCH_REBASE_MIN ? min : 0;
  const divisor =
    maxAbs >= EPOCH_MICROSECOND_ABS
      ? 1_000_000
      : maxAbs >= EPOCH_MILLISECOND_ABS
        ? 1000
        : 1;
  return {origin, divisor, max: (max - origin) / divisor};
}

export function normalizeTripTimestamp(
  value: number,
  plan: TripTimestampNormalization,
): number {
  if (!Number.isFinite(value)) return 0;
  return (value - plan.origin) / plan.divisor;
}

/**
 * Scan a `List<Timestamp | number>` column and return the normalization that
 * both the animation clock and the GPU buffer must share.
 */
export function summarizeTripTimestamps(
  vector: Vector,
): TripTimestampNormalization | null {
  let min = Infinity;
  let max = -Infinity;
  for (const chunk of vector.data) {
    const child = chunk.children[0];
    const offsets = chunk.valueOffsets;
    if (!child || !offsets || offsets.length < 2) continue;
    // The offset buffer is often longer than length + 1. The valid span is
    // offsets[0] .. offsets[length].
    const start = Number(offsets[0] ?? 0);
    const end = Number(offsets[chunk.length] ?? start);
    for (let index = start; index < end; index++) {
      const value = readTripTimestampValue(child, index);
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return planTripTimestampNormalization(min, max);
}

/** Fill the Float32 timestamp buffer TripsLayer uploads for one chunk. */
export function normalizeTripTimestampRange(
  child: Data,
  start: number,
  count: number,
  plan: TripTimestampNormalization,
): Float32Array {
  const values = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    values[index] = normalizeTripTimestamp(
      readTripTimestampValue(child, start + index),
      plan,
    );
  }
  return values;
}
