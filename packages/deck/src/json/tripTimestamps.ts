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
  /** Raw Arrow origin, subtracted before conversion to preserve small deltas. */
  timestampOrigin?: bigint;
};

// Prepared Arrow vectors are immutable inputs. Weak keys let replacement
// datasets release both the summary and the GPU buffers cached for playback.
const summaries = new WeakMap<Vector, TripTimestampNormalization | null>();
const normalizedChunks = new WeakMap<Vector, Float32Array[]>();

/**
 * Numeric magnitudes at or above this are epoch-scale (unix seconds and up).
 * The animation clock starts at 0, so leaving them absolute means the playhead
 * never reaches the data.
 */
const EPOCH_REBASE_MIN = 1e8;

/** Epoch milliseconds, or Arrow timestamps already converted to milliseconds. */
const EPOCH_MILLISECOND_ABS = 1e11;

/** Raw microseconds that were not a Timestamp type (Arrow would already be ms). */
const EPOCH_MICROSECOND_ABS = 1e14;

/**
 * Keep typed Arrow timestamps as bigint until rebasing; numeric columns keep
 * their original units. Nulls must not contribute to the animation range.
 */
function readTripTimestampValue(child: Data, index: number): number | bigint {
  if (!child.getValid(index)) return NaN;
  const raw = child.values?.[index];
  return DataType.isTimestamp(child.type) && typeof raw === 'bigint'
    ? raw
    : Number(raw);
}

/** Convert Arrow timestamp units to the milliseconds used by JSON settings. */
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
function planTripTimestampNormalization(
  min: number,
  max: number,
): TripTimestampNormalization | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  const origin = min < 0 || min >= EPOCH_REBASE_MIN ? min : 0;
  const divisor =
    maxAbs >= EPOCH_MICROSECOND_ABS
      ? 1_000_000
      : maxAbs >= EPOCH_MILLISECOND_ABS
        ? 1000
        : 1;
  return {origin, divisor, max: (max - origin) / divisor};
}

/** Normalize a playhead or vertex value; invalid vertices use the range start. */
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
  const cached = summaries.get(vector);
  if (cached !== undefined) return cached;
  let min: number | bigint = Infinity;
  let max: number | bigint = -Infinity;
  let timestampChild: Data | undefined;
  for (const chunk of vector.data) {
    const child = chunk.children[0];
    const offsets = chunk.valueOffsets;
    if (!child || !offsets || offsets.length < 2) continue;
    if (DataType.isTimestamp(child.type)) timestampChild = child;
    for (let row = 0; row < chunk.length; row++) {
      if (!chunk.getValid(row)) continue;
      for (let index = offsets[row]!; index < offsets[row + 1]!; index++) {
        const value = readTripTimestampValue(child, index);
        if (typeof value === 'number' && !Number.isFinite(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
  }
  const summary =
    timestampChild && typeof min === 'bigint' && typeof max === 'bigint'
      ? {
          origin: timestampToMilliseconds(timestampChild, Number(min)),
          divisor: 1000,
          max:
            timestampToMilliseconds(timestampChild, Number(max - min)) / 1000,
          timestampOrigin: min,
        }
      : planTripTimestampNormalization(Number(min), Number(max));
  summaries.set(vector, summary);
  return summary;
}

/** Return a cached Float32 buffer for a timestamp chunk, preserving null slots. */
export function getNormalizedTripTimestampChunk(
  vector: Vector,
  chunkIndex: number,
): Float32Array {
  let chunks = normalizedChunks.get(vector);
  if (!chunks) {
    chunks = [];
    normalizedChunks.set(vector, chunks);
  }
  const cached = chunks[chunkIndex];
  if (cached) return cached;
  const chunk = vector.data[chunkIndex]!;
  const offsets = chunk.valueOffsets;
  const start = offsets[0] ?? 0;
  const values = new Float32Array((offsets[chunk.length] ?? start) - start);
  const plan = summarizeTripTimestamps(vector);
  const child = chunk.children[0];
  if (plan && child) {
    for (let row = 0; row < chunk.length; row++) {
      if (!chunk.getValid(row)) continue;
      for (let index = offsets[row]!; index < offsets[row + 1]!; index++) {
        const value = readTripTimestampValue(child, index);
        values[index - start] =
          typeof value === 'bigint'
            ? timestampToMilliseconds(
                child,
                Number(value - plan.timestampOrigin!),
              ) / plan.divisor
            : normalizeTripTimestamp(value, plan);
      }
    }
  }
  chunks[chunkIndex] = values;
  return values;
}
