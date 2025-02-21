import type {LanguageModelV1} from '@ai-sdk/provider';
import {arrowTableToJson, getDuckDb} from '@sqlrooms/duckdb';
import {StepResult} from 'ai';
import * as duckdb from '@duckdb/duckdb-wasm';
import {
  CallbackFunctionProps,
  createAssistant,
  ToolCallMessage,
} from '@openassistant/core';

import {ChartToolParameters, QueryToolParameters} from './schemas';
import {queryMessage} from './QueryResult';
import {isChartToolParameters, isQueryToolParameters} from './ToolCall';

/**
 * System prompt for the AI assistant
 */
const SYSTEM_PROMPT = `
You are analyzing tables in DuckDB database in the context of a project.
You can run SQL queries to perform analysis and answer questions.
Reason step by step.
When you give the final answer, provide an explanation for how you got it.

Please use the following schema for the tables:
`;

/**
 * Get the schema of the tables in the database
 * @returns The schema of the tables
 */
async function getTablesSchema() {
  const {conn} = await getDuckDb();
  const result = await conn.query('DESCRIBE');
  return JSON.stringify(arrowTableToJson(result));
}

/**
 * Get summary statistics for a SQL query result
 * @param conn - DuckDB connection
 * @param sqlQuery - The original SQL query
 * @returns Summary statistics as JSON, or null if summary cannot be generated
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
 * Run analysis on the project data
 * @param prompt - The prompt for the analysis
 * @param abortSignal - An optional abort signal to cancel the analysis
 * @returns The tool calls and the final answer
 */
export async function runAnalysis({
  model,
  apiKey,
  prompt,
  abortSignal,
  onStepFinish,
  onStreamResult,
  maxSteps = 100,
}: {
  prompt: string;
  tableSchema: string;
  abortSignal?: AbortSignal;
  apiKey: string;
  onStepFinish?: (
    event: StepResult<typeof TOOLS>,
    toolCallMessages: ToolCallMessage[],
  ) => Promise<void> | void;
  model: LanguageModelV1;
  maxSteps?: number;
  onStreamResult: (message: string, isCompleted: boolean) => void;
}) {
  // TODO: get tables schema from the project store when loading the data
  const tablesSchema = await getTablesSchema();

  const assistant = await createAssistant({
    name: 'sqlrooms-ai',
    modelProvider: 'openai',
    model: model.modelId, // TODO: no need to pass model, it will be handled by openassistant/core
    apiKey,
    version: 'v1',
    instructions: `${SYSTEM_PROMPT}\n${tablesSchema}`,
    // @ts-expect-error update the type in openassistant-core
    functions: TOOLS,
    temperature: 0,
    toolChoice: 'auto', // this will enable streaming
    maxSteps,
    abortSignal,
  });

  const result = await assistant.processTextMessage({
    textMessage: prompt,
    streamMessageCallback: (message) => {
      // the final result (before the answer) can be streamed back here
      onStreamResult(message.deltaMessage, message.isCompleted ?? false);
    },
    onStepFinish,
  });

  return result;
}

/**
 * Get the error message from the error object when function call fails
 * @param error - The error object
 * @returns The error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause instanceof Error) {
      return error.cause.message;
    }
    return error.message;
  }
  return String(error);
}

const TOOLS = {
  query: {
    description: `A tool for executing SQL queries in DuckDB that is embedded in browser using duckdb-wasm.
Query results are returned as a json object "{success: boolean, data: object[], error?: string}"
Please only analyze tables which are in the main schema.
To obtain stats, use the "SUMMARIZE table_name" query.
Don't execute queries that modify data unless explicitly asked.`,
    parameters: QueryToolParameters,
    executeWithContext: async (props: CallbackFunctionProps) => {
      if (!isQueryToolParameters(props.functionArgs)) {
        return {
          name: 'query',
          result: {
            success: false,
            error: 'Invalid query parameters',
          },
        };
      }

      const {type, sqlQuery} = props.functionArgs;
      try {
        const {conn} = await getDuckDb();
        // TODO use options.abortSignal: maybe call db.cancelPendingQuery
        const result = await conn.query(sqlQuery);

        // get the schema of the result
        const schema = result.schema;

        // Get summary using the new function
        const summaryData = await getQuerySummary(conn, sqlQuery);

        // create result object sent back to LLM for tool call
        const llmResult = {
          type,
          success: true,
          data: {
            // only schema and summary will be sent back to LLM as context
            schema,
            summary: summaryData,
          },
        };

        // data object of the raw query result, which is NOT sent back to LLM
        // we can use it to visualize the arrow table in the callback function `message()` below
        const data = {
          arrowTable: result,
        };

        return {
          name: 'query',
          result: llmResult,
          data,
        };
      } catch (error) {
        console.error('SQL query error:', error);
        return {
          name: 'query',
          result: {
            success: false,
            error: getErrorMessage(error),
          },
        };
      }
    },
    message: queryMessage,
  },

  chart: {
    description: `A tool for creating VegaLite charts based on the schema of the SQL query result from the "query" tool.
In the response:
- omit the data from the vegaLiteSpec
- provide an sql query in sqlQuery instead.`,
    parameters: ChartToolParameters,
    executeWithContext: async (props: CallbackFunctionProps) => {
      if (!isChartToolParameters(props.functionArgs)) {
        return {
          name: 'chart',
          result: {
            success: false,
            error: 'Invalid chart parameters',
          },
        };
      }
      const {sqlQuery, vegaLiteSpec} = props.functionArgs;
      const llmResult = {
        success: true,
        details: 'Chart created successfully.',
      };

      // data object of the vegaLiteSpec and sqlQuery
      // it is not used yet, but we can use it to create a JSON editor for user to edit the vegaLiteSpec so that chart can be updated
      const data = {
        sqlQuery,
        vegaLiteSpec,
      };

      return {
        name: 'chart',
        result: llmResult,
        data,
      };
    },
  },

  // answer tool: the LLM will provide a structured answer
  // answer: {
  //   description:
  //     'A tool for providing the final answer. The argument type is `answer`.',
  //   parameters: AnswerToolParameters,
  //   executeWithContext: async (props: CallbackFunctionProps) => {
  //     const {answer} = props.functionArgs;
  //     return {
  //       result: {
  //         success: true,
  //         data: answer,
  //       },
  //     };
  //   },
  // },
};
