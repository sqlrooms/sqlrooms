import type {LanguageModelV1} from '@ai-sdk/provider';
import {arrowTableToJson, getDuckDb} from '@sqlrooms/duckdb';
import {StepResult} from 'ai';
import {CallbackFunctionProps, createAssistant} from '@openassistant/core';

import {AnswerToolParameters, QueryToolParameters} from './schemas';

const SYSTEM_PROMPT = `
You are analyzing tables in DuckDB database in the context of a project.
You can run SQL queries to perform analysis and answer questions.
Reason step by step.
When you give the final answer, provide an explanation for how you got it.

Please use the following schema for the tables:
`;

async function getTablesSchema() {
  const {conn} = await getDuckDb();
  const result = await conn.query('DESCRIBE');
  return JSON.stringify(arrowTableToJson(result));
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
  onStepFinish?: (event: StepResult<typeof TOOLS>) => Promise<void> | void;
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

const TOOLS = {
  query: {
    description:
      'A tool for executing SQL queries in DuckDB that is embedded in browser using duckdb-wasm. ' +
      'Query results are returned as a json object `{success: boolean, data: object[], error?: string}`. ' +
      'You should only analyze tables which are in the main schema. ' +
      'Avoid queries returning too much data to prevent the browser from crashing. ' +
      'Include VegaLite charts in your response based on the SQL query. ' +
      'Omit the data from the chart.vegaLiteSpec in the response, provide an sql query in chart.sqlQuery instead. ' +
      'To obtain stats, use the `SUMMARIZE table_name` query. ' +
      "Don't execute queries that modify data unless explicitly asked. " +
      'The type of the query is `query`.',
    parameters: QueryToolParameters,
    executeWithContext: async (props: CallbackFunctionProps) => {
      const {type, sqlQuery, reasoning} = props.functionArgs;
      console.log('query', {type, sqlQuery, reasoning});
      try {
        const {conn} = await getDuckDb();
        // TODO use options.abortSignal: maybe call db.cancelPendingQuery
        const result = await conn.query(sqlQuery as string);
        // if (options.abortSignal?.aborted) {
        //   throw new Error('Query aborted');
        // }
        const data = arrowTableToJson(result);

        return {
          result: {
            type,
            success: true,
            data,
          },
          data,
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
          result: {
            success: false,
            error: errorMessage,
          },
        };
      }
    },
  },

  // answer tool: the LLM will provide a structured answer
  answer: {
    description:
      'A tool for providing the final answer. The argument type is `answer`.',
    parameters: AnswerToolParameters,
    executeWithContext: async (props: CallbackFunctionProps) => {
      const {answer} = props.functionArgs;
      return {
        result: {
          success: true,
          data: answer,
        },
      };
    },
  },
};
