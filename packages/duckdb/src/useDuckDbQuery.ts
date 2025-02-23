import * as arrow from 'apache-arrow';
import {useEffect, useState} from 'react';
import {getDuckDb} from './useDuckDb';

/**
 * A wrapper interface that exposes the underlying Arrow table,
 * a typed row accessor, and the number of rows.
 */
export interface DuckDbQueryResult<T> {
  /** The underlying Arrow table */
  arrowTable: arrow.Table;
  /** Returns a typed row at the specified index by converting on demand */
  getRow(index: number): T;
  /** Number of rows in the table */
  length: number;
}

/**
 * Creates a row accessor wrapper around an Arrow table that provides typed row access.
 */
function createTypedRowAccessor<T>(
  arrowTable: arrow.Table,
): DuckDbQueryResult<T> {
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
      return row as T;
    },
  };
}

/**
 * A React hook for executing DuckDB queries with automatic state management.
 *
 * This hook provides a convenient way to execute DuckDB queries in React components
 * with built-in state management for loading, error, and result states.
 *
 * Features:
 * - Type-safe results with TypeScript
 * - Automatic cleanup on unmount
 * - Loading and error state management
 * - Conditional execution with `enabled` option
 * - Built-in typed row access
 *
 * @example
 * // Basic usage with typed row access
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 *
 * const {data, isLoading, error} = useDuckDbQuery<User>({
 *   query: 'SELECT id, name, email FROM users'
 * });
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (!data) return null;
 *
 * // Access typed rows using getRow
 * const firstUser = data.getRow(0); // Type: User
 * console.log(firstUser.name); // Typed access to fields
 *
 * // Iterate over all rows
 * for (let i = 0; i < data.length; i++) {
 *   const user = data.getRow(i);
 *   console.log(`${user.id}: ${user.name}`);
 * }
 *
 * @example
 * // Working directly with Arrow table
 * const {data} = useDuckDbQuery<{value: number}>({
 *   query: 'SELECT value FROM measurements'
 * });
 *
 * if (data) {
 *   // Access the underlying Arrow table
 *   const arrowTable = data.arrowTable;
 *
 *   // Get column by name
 *   const valueColumn = arrowTable.getChild('value');
 *
 *   // Compute column statistics
 *   const sum = valueColumn.reduce((a, b) => a + (b as number), 0);
 *   const avg = sum / arrowTable.numRows;
 *
 *   // Batch process rows using Arrow APIs
 *   const values = Array.from(valueColumn);
 * }
 *
 * @template Row The type of each row in the result
 * @param config Configuration including query and execution control
 * @returns Object containing the query result, loading state, and any error that occurred
 */
export function useDuckDbQuery<Row>({
  query,
  enabled,
}: {
  query: string;
  enabled?: boolean;
}) {
  const [data, setData] = useState<DuckDbQueryResult<Row> | undefined>(
    undefined,
  );

  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!enabled && enabled !== undefined) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const duckDb = await getDuckDb();
        const result = await duckDb.conn.query(query);
        const rowAccessor = createTypedRowAccessor<Row>(result);

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
  }, [query, enabled]);

  return {
    data,
    error,
    isLoading,
  };
}
