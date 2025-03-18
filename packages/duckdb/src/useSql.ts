import * as arrow from 'apache-arrow';
import {useEffect, useState} from 'react';
import {getDuckDb, getGlobalDuckDbConnector} from './useDuckDb';
import {z} from 'zod';
import {DuckDbConnector} from './types';

/**
 * A wrapper interface that exposes the underlying Arrow table,
 * a typed row accessor, and the number of rows.
 */
export interface UseSqlQueryResult<T> {
  /** The underlying Arrow table */
  arrowTable: arrow.Table;
  /** Returns a typed row at the specified index by converting on demand */
  getRow(index: number): T;
  /** Number of rows in the table */
  length: number;
  /** Returns an iterator that yields each row in the table */
  rows(): IterableIterator<T>;
  /** Returns an array containing all rows in the table */
  toArray(): T[];
}

/**
 * @deprecated Use UseSqlQueryResult instead
 */
export type DuckDbQueryResult<T> = UseSqlQueryResult<T>;

/**
 * Creates a row accessor wrapper around an Arrow table that provides typed row access.
 */
function createTypedRowAccessor<T>({
  arrowTable,
  validate,
}: {
  arrowTable: arrow.Table;
  validate?: (row: unknown) => T;
}): UseSqlQueryResult<T> {
  return {
    arrowTable,
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
      const result: T[] = [];
      for (let i = 0; i < this.length; i++) {
        result.push(this.getRow(i));
      }
      return result;
    },
  };
}

/**
 * A React hook for executing SQL queries with automatic state management.
 * Provides two ways to ensure type safety:
 * 1. Using TypeScript types (compile-time safety only)
 * 2. Using Zod schemas (both compile-time and runtime validation)
 *
 * @param options Configuration object containing the query and execution control
 * @param connector Optional DuckDB connector to use (falls back to global one if not provided)
 * @returns Object containing the query result, loading state, and any error
 */
export function useSql<Row>(
  options: {query: string; enabled?: boolean},
  connector?: DuckDbConnector,
): {
  data: UseSqlQueryResult<Row> | undefined;
  error: Error | null;
  isLoading: boolean;
};

/**
 * A React hook for executing SQL queries with automatic state management.
 * This overload validates the query results against a Zod schema.
 *
 * @param schema A Zod schema that defines the expected shape and validation rules for each row
 * @param options Configuration object containing the query and execution control
 * @param connector Optional DuckDB connector to use (falls back to global one if not provided)
 * @returns Object containing the validated query result, loading state, and any error
 */
export function useSql<Schema extends z.ZodType>(
  schema: Schema,
  options: {
    query: string;
    enabled?: boolean;
  },
  connector?: DuckDbConnector,
): {
  data: UseSqlQueryResult<z.infer<Schema>> | undefined;
  error: Error | null;
  isLoading: boolean;
};

/**
 * Implementation of useSql that handles both overloads
 */
export function useSql<Row, Schema extends z.ZodType = z.ZodType>(
  schemaOrOptions: Schema | {query: string; enabled?: boolean},
  maybeOptionsOrConnector?:
    | {query: string; enabled?: boolean}
    | DuckDbConnector,
  maybeConnector?: DuckDbConnector,
) {
  // Determine if we're using the schema overload
  const hasSchema =
    maybeOptionsOrConnector !== undefined && 'query' in maybeOptionsOrConnector;
  const options = hasSchema
    ? (maybeOptionsOrConnector as {query: string; enabled?: boolean})
    : (schemaOrOptions as {query: string; enabled?: boolean});
  const schema = hasSchema ? (schemaOrOptions as Schema) : undefined;

  // Determine the connector to use
  const connector = hasSchema
    ? maybeConnector
    : (maybeOptionsOrConnector as DuckDbConnector | undefined);

  const [data, setData] = useState<UseSqlQueryResult<Row> | undefined>(
    undefined,
  );
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!options.enabled && options.enabled !== undefined) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Use the provided connector or fall back to the global one
        const duckDbConnector = connector || (await getGlobalDuckDbConnector());
        const result = await duckDbConnector.query(options.query);

        // Create a row accessor that optionally validates with the schema
        const rowAccessor = createTypedRowAccessor<Row>({
          arrowTable: result,
          validate: schema ? (row: unknown) => schema.parse(row) : undefined,
        });

        if (isMounted) {
          setData(rowAccessor);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [options.query, options.enabled, connector]);

  return {
    data,
    error,
    isLoading,
  };
}

/**
 * @deprecated Use useSql instead
 */
export const useDuckDbQuery = useSql;
