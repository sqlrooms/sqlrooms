import * as arrow from 'apache-arrow';

export interface TypedRowAccessor<T> extends Iterable<T> {
  /** Returns a typed row at the specified index by converting on demand */
  getRow(index: number): T;
  /** Number of rows in the table */
  length: number;
  /** Returns an iterator that yields each row in the table */
  rows(): IterableIterator<T>;
  /** Returns an array containing all rows in the table. The array is cached and reused. */
  toArray(): T[];
}

/** Converts Arrow's raw fixed-width decimal representation to a JSON string. */
function decimalToString(value: Uint32Array | bigint, scale: number): string {
  let unscaled: bigint;
  if (typeof value === 'bigint') {
    unscaled = value;
  } else {
    let unsigned = 0n;
    for (let i = 0; i < value.length; i++) {
      unsigned |= BigInt(value[i]!) << BigInt(i * 32);
    }
    const bits = BigInt(value.length * 32);
    const signBit = 1n << (bits - 1n);
    unscaled = (unsigned & signBit) === 0n ? unsigned : unsigned - (1n << bits);
  }

  if (scale < 0) {
    return (unscaled * 10n ** BigInt(-scale)).toString();
  }

  const sign = unscaled < 0n ? '-' : '';
  const digits = (unscaled < 0n ? -unscaled : unscaled).toString();
  if (scale === 0) {
    return `${sign}${digits}`;
  }
  const padded = digits.padStart(scale + 1, '0');
  return `${sign}${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}

/** Recursively converts Arrow values to JSON-compatible JS values. */
function getJsonValue(type: arrow.DataType, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (
    arrow.DataType.isDecimal(type) &&
    (typeof value === 'bigint' || value instanceof Uint32Array)
  ) {
    return decimalToString(value, type.scale);
  }
  if (typeof value === 'bigint') {
    return value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
      ? Number(value)
      : value.toString();
  }
  if (arrow.DataType.isList(type) || arrow.DataType.isFixedSizeList(type)) {
    return Array.from(value as Iterable<unknown>, (item) =>
      getJsonValue(type.valueType, item),
    );
  }
  if (arrow.DataType.isStruct(type)) {
    const row = value as Record<string, unknown>;
    return Object.fromEntries(
      type.children.map((child) => [
        child.name,
        getJsonValue(child.type, row[child.name]),
      ]),
    );
  }
  if (arrow.DataType.isMap(type)) {
    return Object.fromEntries(
      Array.from(value as Iterable<[unknown, unknown]>, ([key, mapValue]) => [
        String(key),
        getJsonValue(type.valueType, mapValue),
      ]),
    );
  }
  if (arrow.DataType.isDictionary(type)) {
    return getJsonValue(type.dictionary, value);
  }
  return value;
}

/**
 * Creates a row accessor wrapper around an Arrow table that provides typed row access.
 */
export function createTypedRowAccessor<T extends arrow.TypeMap = any>({
  arrowTable,
  validate,
}: {
  arrowTable: arrow.Table<T>;
  validate?: (row: unknown) => T;
}): TypedRowAccessor<T> {
  return createRowAccessor({arrowTable, validate, jsonCompatible: false});
}

/** @internal Creates the JSON-compatible row accessor used by queryJson. */
export function createJsonRowAccessor<T extends arrow.TypeMap = any>({
  arrowTable,
  validate,
}: {
  arrowTable: arrow.Table<T>;
  validate?: (row: unknown) => T;
}): TypedRowAccessor<T> {
  return createRowAccessor({arrowTable, validate, jsonCompatible: true});
}

function createRowAccessor<T extends arrow.TypeMap = any>({
  arrowTable,
  validate,
  jsonCompatible,
}: {
  arrowTable: arrow.Table<T>;
  validate?: (row: unknown) => T;
  jsonCompatible: boolean;
}): TypedRowAccessor<T> {
  let cachedArray: T[] | undefined;

  return {
    get length() {
      return arrowTable.numRows;
    },
    getRow(index: number): T {
      const row: Record<string, unknown> = {};
      arrowTable.schema.fields.forEach((field: arrow.Field) => {
        const column = arrowTable.getChild(field.name);
        if (column) {
          const value = column.get(index);
          row[field.name] = jsonCompatible
            ? getJsonValue(field.type, value)
            : value;
        }
      });

      // If a validator is provided, use it to validate/parse the row
      if (validate) {
        return validate(row);
      }
      return row as T;
    },
    *rows(): IterableIterator<T> {
      for (let i = 0; i < this.length; i++) {
        yield this.getRow(i);
      }
    },
    toArray(): T[] {
      if (cachedArray) {
        return cachedArray;
      }
      const result: T[] = [];
      for (let i = 0; i < this.length; i++) {
        result.push(this.getRow(i));
      }
      cachedArray = result;
      return result;
    },
    [Symbol.iterator](): IterableIterator<T> {
      return this.rows();
    },
  };
}
