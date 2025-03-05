import * as duckdb from '@duckdb/duckdb-wasm';
import {
  createAssistant,
  tool,
  StreamMessage,
  rebuildMessages,
} from '@openassistant/core';
import {
  arrowTableToJson,
  getDuckDb,
  getDuckTableSchemas,
} from '@sqlrooms/duckdb';

import {ToolQuery} from './components/ToolQuery';
import {ToolChart} from './components/ToolChart';
import {
  AnalysisResultSchema,
  ChartToolParameters,
  QueryToolParameters,
} from './schemas';

/**
 * System prompt template for the AI assistant that provides instructions for:
 * - Using DuckDB-specific SQL syntax and functions
 * - Handling query results and error cases
 * - Creating visualizations with VegaLite
 * - Formatting final answers
 */
const SYSTEM_PROMPT = `
You are analyzing tables in DuckDB database in the context of a project.

Instructions for analysis:
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
- For each prompt, please alwasy provide the final answer.

Please use the following schema for the tables:
`;

/**
 * Generates summary statistics for a SQL query result
 * @param conn - DuckDB connection instance
 * @param sqlQuery - SQL SELECT query to analyze
 * @returns Summary statistics as JSON object, or null if the query is not a SELECT statement or if summary generation fails
 */
async function getQuerySummary(
  conn: duckdb.AsyncDuckDBConnection,
  sqlQuery: string,
) {
  if (!sqlQuery.toLowerCase().trim().startsWith('select')) {
    return null;
  }

  try {
    const viewName = `temp_result_${Date.now()}`; // unique view name to avoid conflicts
    await conn.query(`CREATE TEMPORARY VIEW ${viewName} AS ${sqlQuery}`);
    const summaryResult = await conn.query(`SUMMARIZE ${viewName}`);
    const summaryData = arrowTableToJson(summaryResult);
    await conn.query(`DROP VIEW IF EXISTS ${viewName}`);
    return summaryData;
  } catch (error) {
    console.warn('Failed to get summary:', error);
    return null;
  }
}

/**
 * Configuration options for running an AI analysis session
 */
export type AnalysisConfig = {
  /** Assistant instance identifier (default: 'sqlrooms-ai') */
  name?: string;

  /** AI model provider (e.g., 'openai', 'anthropic') */
  modelProvider: string;

  /** Model identifier (e.g., 'gpt-4', 'claude-3') */
  model: string;

  /** Authentication key for the model provider's API */
  apiKey: string;

  /** Analysis prompt or question to be processed */
  prompt: string;

  /** Optional controller for canceling the analysis operation */
  abortController?: AbortController;

  /** Maximum number of analysis steps allowed (default: 100) */
  maxSteps?: number;

  /** */
  historyAnalysis?: AnalysisResultSchema[];

  /**
   * Callback for handling streaming results
   * @param isCompleted - Indicates if this is the final message in the stream
   * @param streamMessage - Current message content being streamed
   */
  onStreamResult: (isCompleted: boolean, streamMessage?: StreamMessage) => void;
};

/**
 * Executes an AI analysis session on the project data
 *
 * @param config - Analysis configuration options. See {@link AnalysisConfig} for more details.
 * @returns Object containing tool calls executed and the final analysis result
 */
export async function runAnalysis({
  name = 'sqlrooms-ai',
  modelProvider,
  model,
  apiKey,
  prompt,
  abortController,
  historyAnalysis,
  onStreamResult,
  maxSteps = 5,
}: AnalysisConfig) {
  const tablesSchema = await getDuckTableSchemas();

  // get the singlton assistant instance
  const assistant = await createAssistant({
    name,
    modelProvider,
    model,
    apiKey,
    version: 'v1',
    instructions: `${SYSTEM_PROMPT}\n${JSON.stringify(tablesSchema)}`,
    functions: TOOLS,
    temperature: 0,
    toolChoice: 'auto', // this will enable streaming
    maxSteps,
    ...(abortController ? {abortController} : {}),
  });

  // restore ai messages from historyAnalysis
  if (historyAnalysis) {
    const historyMessages = historyAnalysis.map((analysis) => ({
      prompt: analysis.prompt,
      response: analysis.streamMessage,
    }));
    const initalMessages = rebuildMessages(historyMessages);
    assistant.setMessages(initalMessages);
  }

  // process the prompt
  const newMessages = await assistant.processTextMessage({
    textMessage: prompt,
    streamMessageCallback: ({isCompleted, message}) => {
      onStreamResult(isCompleted ?? false, message);
    },
  });

  return newMessages;
}

/**
 * Collection of tools available to the AI assistant for data analysis
 * Includes:
 * - query: Executes SQL queries against DuckDB
 * - chart: Creates VegaLite visualizations
 */
export const TOOLS = {
  query: tool({
    description: `A tool for running SQL queries on the tables in the database.
Please only run one query at a time.
If a query fails, please don't try to run it again with the same syntax.`,
    parameters: QueryToolParameters,
    execute: async ({type, sqlQuery}) => {
      const {conn} = await getDuckDb();
      // TODO use options.abortSignal: maybe call db.cancelPendingQuery
      const result = await conn.query(sqlQuery);
      // Only get summary if the query isn't already a SUMMARIZE query
      const summaryData = sqlQuery.toLowerCase().includes('summarize')
        ? arrowTableToJson(result)
        : await getQuerySummary(conn, sqlQuery);

      // Get first 2 rows of the result as a json object
      const subResult = result.slice(0, 2);
      const firstTwoRows = arrowTableToJson(subResult);

      return {
        llmResult: {
          success: true,
          data: {
            type,
            summary: summaryData,
            firstTwoRows,
          },
        },
        output: {
          title: 'Query Result',
          sqlQuery,
        },
      };
    },
    component: ToolQuery,
  }),

  chart: tool({
    description: `A tool for creating VegaLite charts based on the schema of the SQL query result from the "query" tool.
In the response:
- omit the data from the vegaLiteSpec
- provide an sql query in sqlQuery instead.`,
    parameters: ChartToolParameters,
    execute: async ({sqlQuery, vegaLiteSpec}) => {
      // data object of the vegaLiteSpec and sqlQuery
      // it is not used yet, but we can use it to create a JSON editor for user to edit the vegaLiteSpec so that chart can be updated
      return {
        llmResult: {
          success: true,
          details: 'Chart created successfully.',
        },
        output: {
          sqlQuery,
          vegaLiteSpec,
        },
      };
    },
    component: ToolChart,
  }),
};
