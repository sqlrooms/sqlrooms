import type {LanguageModelV1} from '@ai-sdk/provider';
import {arrowTableToJson, getDuckDb} from '@sqlrooms/duckdb';
import {generateText, StepResult, tool, ToolExecutionOptions} from 'ai';
import {
  AnswerToolParameters,
  QueryToolParameters,
  ToolResultSchema,
} from './schemas';

/**
 * Run analysis on the project data
 * @param prompt - The prompt for the analysis
 * @param abortSignal - An optional abort signal to cancel the analysis
 * @returns The tool calls and the final answer
 */
export async function runAnalysis({
  model,
  // prompt,
  abortSignal,
  onStepFinish,
  maxSteps = 100,
  messages,
}: {
  // prompt: string;
  abortSignal?: AbortSignal;
  onStepFinish?: (event: StepResult<typeof TOOLS>) => Promise<void> | void;
  model: LanguageModelV1;
  maxSteps?: number;
  messages?: any[];
}) {
  const result = await generateText({
    model,

    abortSignal,
    // prompt,
    messages,

    tools: TOOLS,

    toolChoice: 'required',
    maxSteps,
    maxRetries: 1,

    system:
      'You are analyzing tables in DuckDB database in the context of a project. ' +
      'You can run SQL queries to perform analysis and answer questions. ' +
      'Reason step by step. ' +
      'When you give the final answer, provide an explanation for how you got it.',

    onStepFinish,
  });

  // const answer = result.toolCalls.find((t) => t.toolName === 'answer');
  // if (!answer) {
  //   console.error('No answer tool call found', {result});
  //   throw new Error('No answer tool call found');
  // }
  // return answer.args;

  return result;
}

const TOOLS = {
  query: tool({
    description:
      'A tool for executing SQL queries in DuckDB that is embedded in browser using duckdb-wasm. ' +
      'You can obtain the structures of all tables and their column types by running `DESCRIBE`. ' +
      'Query results are returned as a json object `{success: boolean, data: object[], error?: string}`. ' +
      'You should only analyze tables which are in the main schema. ' +
      'Avoid queries returning too much data to prevent the browser from crashing. ' +
      'Include VegaLite charts in your response if the data is suitable for it. ' +
      'Omit the data from the chart.vegaLiteSpec in the response, provide an sql query in chart.sqlQuery instead. ' +
      'To obtain stats, use the `SUMMARIZE table_name` query. ' +
      "Don't execute queries that modify data unless explicitly asked. ",
    parameters: QueryToolParameters,

    execute: async (
      {sqlQuery},
      options: ToolExecutionOptions,
    ): Promise<ToolResultSchema['result']> => {
      try {
        const {conn} = await getDuckDb();
        // TODO use options.abortSignal: maybe call db.cancelPendingQuery
        const result = await conn.query(sqlQuery);
        // if (options.abortSignal?.aborted) {
        //   throw new Error('Query aborted');
        // }
        return {
          success: true,
          data: arrowTableToJson(result),
        };
      } catch (error) {
        console.error('SQL query error:', error);
        const errorMessage =
          error instanceof Error
            ? error.cause instanceof Error
              ? error.cause.message
              : error.message
            : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    // TODO: consider experimental_toToolResultContent() for returning Arrow
  }),

  // answer tool: the LLM will provide a structured answer
  answer: tool({
    description: 'A tool for providing the final answer.',
    parameters: AnswerToolParameters,

    // execute: async ({answer}): Promise<ToolResultSchema['result']> => {
    //   return {
    //     success: true,
    //     data: answer,
    //   };
    // },
  }),
};
