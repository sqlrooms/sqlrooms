import * as arrow from 'apache-arrow';
import {useEffect, useState} from 'react';
import {z} from 'zod';
import {useStoreWithDuckDb} from './DuckDbSlice';
import {createTypedRowAccessor, TypedRowAccessor} from './typedRowAccessor';
import {QueryHandle} from './connectors/DuckDbConnector';

/**
 * A wrapper interface that exposes the underlying Arrow table,
 * a typed row accessor, and the number of rows.
 */
export interface UseSqlQueryResult<T> extends TypedRowAccessor<T> {
  /** The underlying Arrow table */
  arrowTable: arrow.Table;
}

/**
 * @deprecated Use UseSqlQueryResult instead
 */
export type DuckDbQueryResult<T> = UseSqlQueryResult<T>;

/**
 * A React hook for executing SQL queries with automatic state management.
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
 * const {data, isLoading, error} = useSql<User>({
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
 * const {data: validatedData, isLoading, error} = useSql(
 *   userSchema,
 *   {query: 'SELECT id, name, email, created_at as createdAt FROM users'}
 * );
 * ```
 *
 * ## Error Handling
 * ```typescript
 * if (isLoading) return <div>Loading...</div>;
 * if (error) {
 *   // With Zod, you can catch validation errors specifically
 *   if (error instanceof z.ZodError) {
 *     return <div>Validation Error: {error.errors[0].message}</div>;
 *   }
 *   return <div>Error: {error.message}</div>;
 * }
 * if (!data) return null;
 * ```
 *
 * ## Data Access Methods
 *
 * There are several ways to access data with different performance characteristics:
 *
 * ### 1. Typed Row Access (getRow, rows(), toArray())
 * - Provides type safety and validation
 * - Converts data to JavaScript objects
 * - Slower for large datasets due to object creation and validation
 *
 * ```typescript
 * // Iterate through rows using the rows() iterator (recommended)
 * for (const user of data.rows()) {
 *   console.log(user.name, user.email);
 * }
 *
 * // Traditional for loop with index access
 * for (let i = 0; i < data.length; i++) {
 *   const user = data.getRow(i);
 *   console.log(`User ${i}: ${user.name} (${user.email})`);
 * }
 *
 * // Get all rows as an array
 * const allUsers = data.toArray();
 *
 * // With Zod schema, transformed fields are available
 * for (const user of validatedData.rows()) {
 *   console.log(`Created: ${user.createdAt.toISOString()}`); // createdAt is a Date object
 * }
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
 * const { data } = useSql<User>({
 *   query: "SELECT * FROM users WHERE age > 30"
 * });
 * ```
 *
 * ### 3. Using Flechette for Advanced Operations
 *
 * For more advanced Arrow operations, consider using [Flechette](https://idl.uw.edu/flechette/),
 * a faster and lighter alternative to the standard Arrow JS implementation.
 *
 * ```typescript
 * // Example using Flechette with SQL query results
 * import { tableFromIPC } from '@uwdata/flechette';
 *
 * // Convert Arrow table to Flechette table
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
 * @param zodSchema A Zod schema that defines the expected shape and validation rules for each row
 * @param options Configuration object containing the query and execution control
 * @returns Object containing the validated query result, loading state, and any error
 */
export function useSql<Row>(options: {query: string; enabled?: boolean}): {
  data: UseSqlQueryResult<Row> | undefined;
  error: Error | null;
  isLoading: boolean;
};

export function useSql<Schema extends z.ZodType>(
  zodSchema: Schema,
  options: {
    query: string;
    enabled?: boolean;
  },
): {
  data: UseSqlQueryResult<z.infer<Schema>> | undefined;
  error: Error | null;
  isLoading: boolean;
};

/**
 * Implementation of useSql that handles both overloads
 */
export function useSql<
  Row extends arrow.TypeMap,
  Schema extends z.ZodType = z.ZodType,
>(
  zodSchemaOrOptions: Schema | {query: string; enabled?: boolean},
  maybeOptions?: {query: string; enabled?: boolean},
) {
  // Determine if we're using the schema overload
  const hasZodSchema = maybeOptions !== undefined;
  const options = hasZodSchema
    ? maybeOptions
    : (zodSchemaOrOptions as {query: string; enabled?: boolean});
  const schema = hasZodSchema ? (zodSchemaOrOptions as Schema) : undefined;

  const [data, setData] = useState<UseSqlQueryResult<Row> | undefined>(
    undefined,
  );
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executeSql = useStoreWithDuckDb((state) => state.db.executeSql);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!options.enabled && options.enabled !== undefined) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const queryHandle = await executeSql(options.query);
        if (!queryHandle || !isMounted) {
          return;
        }

        const result = await queryHandle.result;
        if (!isMounted) {
          return;
        }

        // Create a row accessor that optionally validates with the schema
        const rowAccessor = createTypedRowAccessor<Row>({
          arrowTable: result,
          validate: schema ? (row: unknown) => schema.parse(row) : undefined,
        });

        setData({...rowAccessor, arrowTable: result});
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
  }, [options.query, options.enabled, executeSql]);

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
