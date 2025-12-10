import {AiSliceState} from '@sqlrooms/ai-core';
import {
  arrowTableToJson,
  DuckDbConnector,
  DuckDbSliceState,
  splitSqlStatements,
} from '@sqlrooms/duckdb';
import type {StoreApi} from '@sqlrooms/room-shell';
import {z} from 'zod';
import {QueryToolResult} from './QueryToolResult';

export const QueryToolParameters = z.object({
  type: z.literal('query'),
  sqlQuery: z.string(),
  reasoning: z.string(),
});

export type QueryToolParameters = z.infer<typeof QueryToolParameters>;

export type QueryToolLlmResult = {
  success: boolean;
  data?: {
    type: 'query';
    summary: Record<string, unknown>[] | null;
    firstRows?: Record<string, unknown>[];
  };
  details?: string;
  errorMessage?: string;
};

export type QueryToolAdditionalData = {
  title: string;
  sqlQuery: string;
};

export type QueryToolOptions = {
  readOnly?: boolean;
  autoSummary?: boolean;
  numberOfRowsToShareWithLLM?: number;
};

export function createQueryTool(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
  options?: QueryToolOptions,
) {
  const {
    readOnly = true,
    autoSummary = false,
    numberOfRowsToShareWithLLM = 0,
  } = options || {};
  return {
    name: 'query',
    description: `A tool for running SQL queries on the tables in the database.
Please only run one query at a time.
If a query fails, please don't try to run it again with the same syntax.`,
    parameters: QueryToolParameters,
    execute: async (
      params: QueryToolParameters,
      options?: {abortSignal?: AbortSignal},
    ) => {
      const {type, sqlQuery} = params;
      const abortSignal = options?.abortSignal;

      try {
        const connector = await store.getState().db.getConnector();
        const parsedQuery = await store.getState().db.sqlSelectToJson(sqlQuery);

        if (
          parsedQuery.error &&
          // Only SELECT statements can be serialized to json, so we ignore not implemented errors
          parsedQuery.error_type !== 'not implemented'
        ) {
          throw new Error(parsedQuery.error_message);
        }

        if (readOnly) {
          if (parsedQuery.error) {
            throw new Error(
              `Query is not a valid SELECT statement: ${parsedQuery.error_message}`,
            );
          }
          if (
            parsedQuery.statements.length !== 1 || // only one statement allowed
            parsedQuery.statements[0]?.node.type !== 'SELECT_NODE' // only SELECT statements allowed
          ) {
            throw new Error('Query is not a valid SELECT statement');
          }
        }

        const result = await connector.query(sqlQuery, {signal: abortSignal});

        const summaryData = await (async () => {
          if (!autoSummary) return null;
          if (parsedQuery.error) return null;

          const lastNode =
            parsedQuery.statements[parsedQuery.statements.length - 1]?.node;

          // Only get summary if the last statement isn't already a SUMMARIZE query
          if (
            lastNode?.type === 'SELECT_NODE' &&
            lastNode?.from_table?.show_type === 'SUMMARY'
          ) {
            return arrowTableToJson(result);
          }
          const statements = splitSqlStatements(sqlQuery);
          const lastStatement = statements[statements.length - 1];
          if (!lastStatement) return null;
          return await getQuerySummary(connector, lastStatement, abortSignal);
        })();

        // Conditionally get rows of the result as a json object based on numberOfRowsToShareWithLLM
        const firstRows =
          numberOfRowsToShareWithLLM > 0
            ? arrowTableToJson(result.slice(0, numberOfRowsToShareWithLLM))
            : [];

        return {
          llmResult: {
            success: true,
            data: {
              type,
              summary: summaryData,
              ...(numberOfRowsToShareWithLLM > 0 ? {firstRows} : {}),
            },
          },
          additionalData: {
            title: 'Query Result',
            sqlQuery,
          },
        };
      } catch (error) {
        return {
          llmResult: {
            success: false,
            details: 'Query execution failed.',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    },
    component: QueryToolResult,
  };
}

/**
 * Generates summary statistics for a SQL query result
 * @param connector - DuckDB connection instance
 * @param sqlQuery - SQL SELECT query to analyze
 * @returns Summary statistics as JSON object, or null if the query is not a SELECT statement or if summary generation fails
 */
export async function getQuerySummary(
  connector: DuckDbConnector,
  sqlQuery: string,
  abortSignal?: AbortSignal,
) {
  if (!sqlQuery.toLowerCase().trim().startsWith('select')) {
    return null;
  }

  try {
    const summaryResult = await connector.query(`SUMMARIZE (
      ${sqlQuery}
    )`, {signal: abortSignal});
    return arrowTableToJson(summaryResult);
  } catch (error) {
    console.warn('Failed to get summary for query. Error:', error);
    return null;
  }
}
