import {
  createAssistant,
  rebuildMessages,
  StreamMessage,
  tool,
} from '@openassistant/core';
import {
  arrowTableToJson,
  DataTable,
  DuckDbConnector,
  DuckDbSliceState,
} from '@sqlrooms/duckdb';

import type {StoreApi} from '@sqlrooms/project-builder';
import {AiSliceState, AiSliceTool} from './AiSlice';
import {QueryToolResult} from './components/tools/QueryToolResult';
import {AnalysisResultSchema, QueryToolParameters} from './schemas';

/**
 * System prompt template for the AI assistant that provides instructions for:
 * - Using DuckDB-specific SQL syntax and functions
 * - Handling query results and error cases
 * - Creating visualizations with VegaLite
 * - Formatting final answers
 */
const DEFAULT_INSTRUCTIONS = `
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
- For each prompt, please always provide the final answer.

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
    const viewName = `temp_result_${Date.now()}`; // unique view name to avoid conflicts
    await connector.query(`CREATE TEMPORARY VIEW ${viewName} AS ${sqlQuery}`);
    const summaryResult = await connector.query(`SUMMARIZE ${viewName}`).result;
    const summaryData = arrowTableToJson(summaryResult);
    await connector.query(`DROP VIEW IF EXISTS ${viewName}`);
    return summaryData;
  } catch (error) {
    console.warn('Failed to get summary:', error);
    return null;
  }
}

/**
 * Configuration options for running an AI analysis session
 */
type AnalysisParameters = {
  tableSchemas: DataTable[];

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

  /** The history of analysis results (e.g. saved in localStorage) */
  historyAnalysis?: AnalysisResultSchema[];

  /** Tools to use in the analysis */
  tools?: Record<string, AiSliceTool>;

  /**
   * Function to get custom instructions for the AI assistant
   * @param tablesSchema - The schema of the tables in the database
   * @returns The instructions string to use
   */
  getInstructions?: (tablesSchema: DataTable[]) => string;

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
 * @param config - Analysis configuration options. See {@link AnalysisParameters} for more details.
 * @returns Object containing tool calls executed and the final analysis result
 */
export async function runAnalysis({
  name = 'sqlrooms-ai',
  tableSchemas,
  modelProvider,
  model,
  apiKey,
  prompt,
  abortController,
  historyAnalysis,
  onStreamResult,
  maxSteps = 5,
  tools = {},
  getInstructions,
}: AnalysisParameters) {
  // get the singleton assistant instance
  const assistant = await createAssistant({
    name,
    modelProvider,
    model,
    apiKey,
    version: 'v1',
    instructions: getInstructions
      ? getInstructions(tableSchemas)
      : getDefaultInstructions(tableSchemas),
    functions: tools,
    temperature: 0,
    toolChoice: 'auto', // this will enable streaming
    maxSteps,
    ...(abortController ? {abortController} : {}),
  });

  // restore ai messages from historyAnalysis?
  if (historyAnalysis) {
    const historyMessages = historyAnalysis.map((analysis) => ({
      prompt: analysis.prompt,
      response: analysis.streamMessage,
    }));
    const initialMessages = rebuildMessages(historyMessages);
    assistant.setMessages(initialMessages);
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
 * Default tools available to the AI assistant for data analysis
 * Includes:
 * - query: Executes SQL queries against DuckDB
 */
export function getDefaultTools(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
): Record<string, AiSliceTool> {
  return {
    query: tool({
      description: `A tool for running SQL queries on the tables in the database.
Please only run one query at a time.
If a query fails, please don't try to run it again with the same syntax.`,
      parameters: QueryToolParameters,
      // TODO: specify the return type e.g. Promise<Partial<ToolCallMessage>>
      execute: async ({type, sqlQuery}) => {
        try {
          const connector = await store.getState().db.getConnector();
          // TODO use options.abortSignal: maybe call db.cancelPendingQuery
          const result = await connector.query(sqlQuery).result;
          // Only get summary if the query isn't already a SUMMARIZE query
          const summaryData = sqlQuery.toLowerCase().includes('summarize')
            ? arrowTableToJson(result)
            : await getQuerySummary(connector, sqlQuery);

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
    }),
  };
}
