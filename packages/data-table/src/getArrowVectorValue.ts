import * as arrow from 'apache-arrow';

/** Arrow Type.Int / Flechette Type.Int. */
const INT_TYPE_ID = 2;

type Int64Chunk = {
  getValid?: (index: number) => boolean;
  isValid?: (index: number) => boolean;
  length: number;
  nullCount?: number;
  offset?: number;
  validity?: unknown;
  values?: ArrayLike<unknown>;
};

/**
 * Minimal vector shape shared by Apache Arrow `Vector` and Flechette `Column`.
 */
export type ArrowVectorLike = {
  data?: ReadonlyArray<Int64Chunk>;
  get: (index: number) => unknown;
  isValid?: (index: number) => boolean;
  type?: unknown;
};

function is64BitIntegerType(type: unknown): boolean {
  if (!type || typeof type !== 'object') {
    return false;
  }

  const {bitWidth, typeId} = type as {bitWidth?: number; typeId?: number};
  if (bitWidth !== 64) {
    return false;
  }

  if (typeof typeId === 'number') {
    return typeId === INT_TYPE_ID;
  }

  return arrow.DataType.isInt(type as arrow.DataType);
}

function isChunkValueValid(chunk: Int64Chunk, localIndex: number): boolean {
  // Flechette skips the validity bitmap when a batch has no nulls. Calling
  // `isValid` anyway treats a missing bitmap as all-null.
  if (chunk.nullCount === 0 || chunk.validity == null) {
    return true;
  }
  if (typeof chunk.isValid === 'function') {
    return chunk.isValid(localIndex);
  }
  if (typeof chunk.getValid === 'function') {
    return chunk.getValid(localIndex);
  }
  return true;
}

/**
 * Reads a 64-bit integer from the underlying typed array, skipping the
 * Flechette/Arrow conversion that throws for values outside the safe integer
 * range.
 */
function getRaw64BitIntegerValue(
  vector: ArrowVectorLike,
  index: number,
): bigint | null | undefined {
  const chunks = vector.data;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return undefined;
  }

  let offset = 0;
  for (const chunk of chunks) {
    const length = chunk.length ?? 0;
    if (index >= offset + length) {
      offset += length;
      continue;
    }

    const localIndex = index - offset;
    const valid =
      typeof vector.isValid === 'function'
        ? vector.isValid(index)
        : isChunkValueValid(chunk, localIndex);
    if (!valid) {
      return null;
    }

    const value = chunk.values?.[localIndex + (chunk.offset ?? 0)];
    return typeof value === 'bigint' ? value : undefined;
  }

  return undefined;
}

/**
 * Reads a cell value from an Arrow or Flechette column.
 *
 * 64-bit integer columns are read as `bigint` so values outside
 * `Number.MAX_SAFE_INTEGER` can be displayed. Flechette's default `.get()`
 * converts Int64 to `number` and throws `BigInt exceeds integer number
 * representation` for those values.
 */
export function getArrowVectorValue(
  vector: ArrowVectorLike | null | undefined,
  index: number,
): unknown {
  if (!vector) {
    return undefined;
  }

  if (is64BitIntegerType(vector.type)) {
    const raw = getRaw64BitIntegerValue(vector, index);
    if (raw !== undefined) {
      return raw;
    }
  }

  return vector.get(index);
}
