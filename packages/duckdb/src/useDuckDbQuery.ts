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
  };
}

/**
 * A React hook for executing DuckDB queries with automatic state management.
 * This version provides type safety through TypeScript types but no runtime validation.
 *
 * @example
 * ```typescript
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
 * // Access typed rows
 * const firstUser = data.getRow(0); // Type: User
 * console.log(firstUser.name);
 * ```
 *
 * @template Row The TypeScript type for each row in the result
 * @param options Configuration object containing the query and execution control
 * @returns Object containing the query result, loading state, and any error
 */
export function useDuckDbQuery<Row>(options: {
  query: string;
  enabled?: boolean;
}): {
  data: DuckDbQueryResult<Row> | undefined;
  error: Error | null;
  isLoading: boolean;
};

/**
 * A React hook for executing DuckDB queries with automatic state management and runtime validation.
 * This version uses Zod schemas to provide both compile-time and runtime type safety.
 *
 * Key features:
 * - Runtime validation of each row as it's accessed
 * - Automatic TypeScript type inference from the Zod schema
 * - Validation errors if the data doesn't match the expected shape
 * - Ability to transform data during validation
 *
 * @example
 * ```typescript
 * // Define a schema for your data
 * const userSchema = z.object({
 *   id: z.number(),
 *   name: z.string(),
 *   email: z.string().email(),
 *   createdAt: z.string().transform(str => new Date(str)) // Transform string to Date
 * });
 *
 * // The type is automatically inferred from the schema
 * const {data, isLoading, error} = useDuckDbQuery(
 *   userSchema,
 *   {query: 'SELECT id, name, email, created_at FROM users'}
 * );
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) {
 *   // Error will be a ZodError if validation fails
 *   if (error instanceof z.ZodError) {
 *     return <div>Validation Error: {error.errors[0].message}</div>;
 *   }
 *   return <div>Error: {error.message}</div>;
 * }
 * if (!data) return null;
 *
 * // Rows are validated and transformed according to the schema
 * const user = data.getRow(0);
 * console.log(user.createdAt.toISOString()); // createdAt is now a Date object
 * ```
 *
 * @template Schema The Zod schema type that defines the shape and validation of each row
 * @param schema A Zod schema that defines the expected shape and validation rules for each row
 * @param options Configuration object containing the query and execution control
 * @returns Object containing the validated query result, loading state, and any error
 */
export function useDuckDbQuery<Schema extends z.ZodType>(
  schema: Schema,
  options: {
    query: string;
    enabled?: boolean;
  },
): {
  data: DuckDbQueryResult<z.infer<Schema>> | undefined;
  error: Error | null;
  isLoading: boolean;
};

/**
 * Implementation of useDuckDbQuery that handles both overloads
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
