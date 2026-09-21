import * as arrow from 'apache-arrow';
import {getArrowVectorValue} from '../src/getArrowVectorValue';

const UNSAFE_INT64 = 610625465232654335n;

function createThrowingInt64Vector(values: Array<bigint | null>) {
  const stored = values.map((value) => value ?? 0n);
  return {
    type: {bitWidth: 64, typeId: 2},
    data: [
      {
        length: values.length,
        values: stored,
        isValid: (index: number) => values[index] != null,
        nullCount: values.filter((value) => value == null).length,
        validity: values.some((value) => value == null) ? true : undefined,
      },
    ],
    get(index: number) {
      const value = values[index];
      if (value == null) {
        return null;
      }
      if (
        value > BigInt(Number.MAX_SAFE_INTEGER) ||
        value < BigInt(Number.MIN_SAFE_INTEGER)
      ) {
        throw new Error(
          `BigInt exceeds integer number representation: ${value}`,
        );
      }
      return Number(value);
    },
  };
}

describe('getArrowVectorValue', () => {
  it('returns Apache Arrow Int64 values that exceed Number.MAX_SAFE_INTEGER', () => {
    const table = new arrow.Table({
      id: arrow.vectorFromArray([UNSAFE_INT64], new arrow.Int64()),
    });

    expect(getArrowVectorValue(table.getChild('id'), 0)).toBe(UNSAFE_INT64);
  });

  it('returns null for invalid Apache Arrow Int64 slots', () => {
    const table = new arrow.Table({
      id: arrow.vectorFromArray([null, UNSAFE_INT64], new arrow.Int64()),
    });
    const vector = table.getChild('id');

    expect(getArrowVectorValue(vector, 0)).toBeNull();
    expect(getArrowVectorValue(vector, 1)).toBe(UNSAFE_INT64);
  });

  it('reads Flechette-style Int64 columns without coercing through Number', () => {
    const vector = createThrowingInt64Vector([UNSAFE_INT64, 7n, null]);

    expect(() => vector.get(0)).toThrow(
      /BigInt exceeds integer number representation/,
    );
    expect(getArrowVectorValue(vector, 0)).toBe(UNSAFE_INT64);
    expect(getArrowVectorValue(vector, 1)).toBe(7n);
    expect(getArrowVectorValue(vector, 2)).toBeNull();
  });

  it('returns undefined when the vector is missing', () => {
    expect(getArrowVectorValue(null, 0)).toBeUndefined();
    expect(getArrowVectorValue(undefined, 0)).toBeUndefined();
  });
});
