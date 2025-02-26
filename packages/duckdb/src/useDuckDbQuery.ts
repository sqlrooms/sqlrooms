import * as arrow from 'apache-arrow';
import {useEffect, useState} from 'react';
import {getDuckDb} from './useDuckDb';
import {z} from 'zod';

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
  /** Returns an iterator that yields each row in the table */
  rows(): IterableIterator<T>;
  /** Returns an array containing all rows in the table */
  toArray(): T[];
}

/**
 * Creates a row accessor wrapper around an Arrow table that provides typed row access.
 */
function createTypedRowAccessor<T>({
  arrowTable,
  validate,
}: {
  arrowTable: arrow.Table;
  validate?: (row: unknown) => T;
}): DuckDbQueryResult<T> {
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
 * A React hook for executing DuckDB queries with automatic state management.
 * Provides two ways to ensure type safety:
 * 1. Using TypeScript types (compile-time safety only)
 * 2. Using Zod schemas (both compile-time and runtime validation)
 *
 * @example
 * ```typescript
 * // Option 1: Using TypeScript types (faster, no runtime validation)
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
 * // Option 2: Using Zod schema (slower but with runtime validation)
 * const userSchema = z.object({
 *   id: z.number(),
 *   name: z.string(),
 *   email: z.string().email(),
 *   createdAt: z.string().transform(str => new Date(str)) // Transform string to Date
 * });
 *
 * const {data: validatedData, isLoading, error} = useDuckDbQuery(
 *   userSchema,
 *   {query: 'SELECT id, name, email, created_at as createdAt FROM users'}
 * );
 *
 * // Error handling is the same for both approaches
 * if (isLoading) return <div>Loading...</div>;
 * if (error) {
 *   // With Zod, you can catch validation errors specifically
 *   if (error instanceof z.ZodError) {
 *     return <div>Validation Error: {error.errors[0].message}</div>;
 *   }
 *   return <div>Error: {error.message}</div>;
 * }
 * if (!data) return null;
 *
 * // Accessing data works the same way for both approaches
 * // Individual row access
 * const user = data.getRow(0);
 * console.log(user.name);
 *
 * // With Zod schema, transformed fields are available
 * // console.log(validatedData.getRow(0).createdAt.toISOString()); // createdAt is a Date object
 *
 * // Iterate through rows using the rows() iterator
 * for (const user of data.rows()) {
 *   console.log(user.name, user.email);
 * }
 *
 * // Get all rows as an array
 * const allUsers = data.toArray();
 * ```
 *
 * ## Performance and Advanced Operations
 *
 * There are several ways to access data with different performance characteristics:
 *
 * ### 1. Typed Row Access (getRow, rows(), toArray())
 * - Provides type safety and validation
 * - Converts data to JavaScript objects
 * - Slower for large datasets due to object creation and validation
 * - Zod validation adds additional overhead but ensures data correctness
 *
 * ```typescript
 * // Access individual rows with type safety
 * const firstRow = data.getRow(0);
 *
 * // Iterate through all rows with the iterator
 * for (const row of data.rows()) {
 *   console.log(row.name);
 * }
 *
 * // Get all rows as an array
 * const allRows = data.toArray();
 * ```
 *
 * ### 2. Direct Arrow Table Access
 * - Much faster for large datasets
 * - Columnar access is more efficient for analytics
 * - No type safety or validation
 *
 * ```typescript
 * // For performance-critical operations with large datasets:
 * const nameColumn = data.arrowTable.getChild('name');
 * const emailColumn = data.arrowTable.getChild('email');
 *
 * // Fast columnar iteration (no object creation)
 * for (let i = 0; i < data.length; i++) {
 *   console.log(nameColumn.get(i), emailColumn.get(i));
 * }
 *
 * // Note: For filtering data, it's most efficient to use SQL in your query
 * // const { data } = useDuckDbQuery<User>({
 * //   query: "SELECT * FROM users WHERE age > 30"
 * // });
 * ```
 *
 * ### 3. Using Flechette for Advanced Operations
 *
 * For more advanced Arrow operations, consider using [Flechette](https://idl.uw.edu/flechette/),
 * a faster and lighter alternative to the standard Arrow JS implementation.
 *
 * ```typescript
 * // Example using Flechette with DuckDB query results
 * import { tableFromIPC } from '@uwdata/flechette';
 *
 * // Convert Arrow table to Flechette table
 * // Note: This serialization step creates a copy of the data
 * const serializedData = data.arrowTable.serialize();
 * const flechetteTable = tableFromIPC(serializedData);
 *
 * // Extract all columns into a { name: array, ... } object
 * const columns = flechetteTable.toColumns();
 *
 * // Create a new table with a selected subset of columns
 * const subtable = flechetteTable.select(['name', 'email']);
 *
 * // Convert to array of objects with customization options
 * const objects = flechetteTable.toArray({
 *   useDate: true,  // Convert timestamps to Date objects
 *   useMap: true    // Create Map objects for key-value pairs
 * });
 *
 * // For large datasets, consider memory management
 * // Once you're done with the Arrow data, you can free the memory
 * serializedData = null; // Allow garbage collection of the serialized data
 * ```
 *
 * Flechette provides several advantages:
 * - Better performance (1.3-1.6x faster value iteration, 7-11x faster row object extraction)
 * - Smaller footprint (~43k minified vs 163k for Arrow JS)
 * - Support for additional data types (including decimal-to-number conversion)
 * - More flexible data value conversion options
 *
 * @template Row The TypeScript type for each row in the result
 * @param options Configuration object containing the query and execution control
 * @returns Object containing the query result, loading state, and any error
 *
 * @template Schema The Zod schema type that defines the shape and validation of each row
 * @param schema A Zod schema that defines the expected shape and validation rules for each row
 * @param options Configuration object containing the query and execution control
 * @returns Object containing the validated query result, loading state, and any error
 */
export function useDuckDbQuery<Row, Schema extends z.ZodType = z.ZodType>(
  schemaOrOptions: Schema | {query: string; enabled?: boolean},
  maybeOptions?: {query: string; enabled?: boolean},
) {
  // Determine if we're using the schema overload
  const hasSchema = maybeOptions !== undefined;
  const options = hasSchema
    ? maybeOptions
    : (schemaOrOptions as {query: string; enabled?: boolean});
  const schema = hasSchema ? (schemaOrOptions as Schema) : undefined;

  const [data, setData] = useState<DuckDbQueryResult<Row> | undefined>(
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
        const duckDb = await getDuckDb();
        const result = await duckDb.conn.query(options.query);

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
  }, [options.query, options.enabled]);

  return {
    data,
    error,
    isLoading,
  };
}
