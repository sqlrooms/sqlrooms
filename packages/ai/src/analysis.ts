import {
  arrowTableToJson,
  DataTable,
  DuckDbConnector,
  DuckDbSliceState,
  splitSqlStatements,
} from '@sqlrooms/duckdb';
import type {StoreApi} from '@sqlrooms/room-shell';
import {AiSliceState, AiSliceTool} from './AiSlice';
import {QueryToolResult} from './components/tools/QueryToolResult';
import {QueryToolParameters} from './schemas';

/**
 * System prompt template for the AI assistant that provides instructions for:
 * - Using DuckDB-specific SQL syntax and functions
 * - Handling query results and error cases
 * - Creating visualizations with VegaLite
 * - Formatting final answers
 */
const DEFAULT_INSTRUCTIONS = `
You are analyzing tables in DuckDB database in the context of a room.

Instructions for analysis:
- When using 'query' tool, please assign parameter 'type' with value 'query'
- Use DuckDB-specific SQL syntax and functions (not Oracle, PostgreSQL, or other SQL dialects)
- Some key DuckDB-specific functions to use:
  * regexp_matches() for regex (not regexp_like)
  * strftime() for date formatting (not to_char)
  * list_aggregate() for array operations
  * unnest() for array expansion
  * regr_sxy()
  * corr()
  * skewness()
- Please always try to use SQL queries to answer users questions
- Please run tool calls sequentially, don't run multiple tool calls in parallel
- IMPORTANT: Do not list out raw query results in your response. Instead:
  * Describe the results in natural language
  * Provide summary statistics
  * Use comparisons and relative terms
  * Include only the most relevant values if necessary
- Break down complex problems into smaller steps
- Use "SUMMARIZE table_name"for quick overview of the table
- Please don't modify data
- IMPORTANT: When you receive an error response from a tool call (where success: false):
  * Stop making any further tool calls immediately
  * Return a final answer that includes the error message
  * Explain what went wrong and suggest possible fixes if applicable

When creating visualizations:
- Follow VegaLite syntax
- Choose appropriate chart types based on the data and analysis goals
- Use clear titles and axis labels
- Consider color schemes for better readability
- Add meaningful tooltips when relevant
- Format numbers and dates appropriately
- Use aggregations when dealing with large datasets

For your final answer:
- Provide an explanation for how you got it
- Explain your reasoning step by step
- Include relevant statistics or metrics
- For each prompt, please always provide the final answer.
- IMPORTANT: Query tool results may include sample rows (firstRows) or may be empty:
  * If no sample rows provided: Never fabricate data. Direct users to the table component for actual results.
  * If sample rows provided: Use them to enhance your analysis, but always direct users to the table component for complete results.

Please use the following schema for the tables:
`;

/**
 * Returns the default system instructions for the AI assistant
 */
export function getDefaultInstructions(tablesSchema: DataTable[]): string {
  return `${DEFAULT_INSTRUCTIONS}\n${JSON.stringify(tablesSchema)}`;
}

/**
 * Generates summary statistics for a SQL query result
 * @param connector - DuckDB connection instance
 * @param sqlQuery - SQL SELECT query to analyze
 * @returns Summary statistics as JSON object, or null if the query is not a SELECT statement or if summary generation fails
 */
async function getQuerySummary(connector: DuckDbConnector, sqlQuery: string) {
  if (!sqlQuery.toLowerCase().trim().startsWith('select')) {
    return null;
  }

  try {
    const summaryResult = await connector.query(`SUMMARIZE (
      ${sqlQuery}
    )`);
    return arrowTableToJson(summaryResult);
  } catch (error) {
    console.warn('Failed to get summary for query. Error:', error);
    return null;
  }
}

export type DefaultToolsOptions = {
  /**
   * Whether to enable read only mode (default: true)
   */
  readOnly?: boolean;
  /**
   * Number of rows to share with LLM (default: 0)
   */

  numberOfRowsToShareWithLLM?: number;
  /**
   * Whether to automatically generate a summary of the query result (default: true)
   */
  autoSummary?: boolean;
};

/**
 * Default tools available to the AI assistant for data analysis
 * Includes:
 * - query: Executes SQL queries against DuckDB
 */
export function getDefaultTools(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
  options?: DefaultToolsOptions,
): Record<string, AiSliceTool> {
  const {
    readOnly = true,
    numberOfRowsToShareWithLLM = 0,
    autoSummary = true,
  } = options || {};
  return {
    query: {
      description: `A tool for running SQL queries on the tables in the database.
Please only run one query at a time.
If a query fails, please don't try to run it again with the same syntax.`,
      parameters: QueryToolParameters,
      execute: async ({type, sqlQuery}) => {
        try {
          const connector = await store.getState().db.getConnector();
          // TODO use options.abortSignal: maybe call db.cancelPendingQuery
          const result = await connector.query(sqlQuery);

          const parsedQuery = await store
            .getState()
            .db.sqlSelectToJson(sqlQuery);

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
            return await getQuerySummary(connector, lastStatement);
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
    },
  };
}
