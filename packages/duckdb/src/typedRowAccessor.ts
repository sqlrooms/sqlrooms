import * as arrow from 'apache-arrow';
import {TypeMap} from 'apache-arrow';

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

/**
 * Creates a row accessor wrapper around an Arrow table that provides typed row access.
 */
export function createTypedRowAccessor<T extends TypeMap = any>({
  arrowTable,
  validate,
}: {
  arrowTable: arrow.Table<T>;
  validate?: (row: unknown) => T;
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
          row[field.name] = column.get(index);
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
