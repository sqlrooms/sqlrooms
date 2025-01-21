import {createOpenAI} from '@ai-sdk/openai';
import {getDuckDb} from '@sqlrooms/duckdb';
import {generateText, StepResult, tool} from 'ai';
import {z} from 'zod';
import {ToolResultSchema, AnalysisAnswerSchema} from './schemas';

const openai = createOpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? '',
});
const MODEL = 'gpt-4o';

/**
 * Run analysis on the project data
 * @param prompt - The prompt for the analysis
 * @param abortSignal - An optional abort signal to cancel the analysis
 * @returns The tool calls and the final answer
 */
export async function runAnalysis({
  prompt,
  abortSignal,
  onStepFinish,
}: {
  prompt: string;
  abortSignal?: AbortSignal;
  onStepFinish?: (event: StepResult<typeof TOOLS>) => Promise<void> | void;
}) {
  const result = await generateText({
    model: openai(MODEL, {
      structuredOutputs: true,
    }),
    abortSignal,

    tools: TOOLS,

    toolChoice: 'required',
    maxSteps: 20,
    maxRetries: 1,

    system:
      'You are analyzing tables in DuckDB database in the context of a project. ' +
      'You can run SQL queries to perform analysis and answer questions. ' +
      'Reason step by step. ' +
      'When you give the final answer, provide an explanation for how you got it.',

    prompt,

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
      'Query results are returned as a superjson object `{success: boolean, data: string(superjson), error?: string}`. ' +
      'You should only analyze tables which are in the main schema. ' +
      'Add LIMIT to each query to avoid returning too much data and crashing the browser. ' +
      'To obtain stats, use the `SUMMARIZE table_name` query. ' +
      "Don't execute queries that modify data unless explicitly asked. ",
    parameters: z.object({sqlQuery: z.string()}),

    execute: async ({sqlQuery}): Promise<ToolResultSchema['result']> => {
      try {
        console.log('Executing SQL query:', sqlQuery);
        const {conn} = await getDuckDb();
        const result = await conn.query(sqlQuery);
        // Convert Arrow table to JSON
        const jsonResult = result
          .toArray()
          .map((d) => JSON.parse(d.toString()));
        return {
          success: true,
          data: jsonResult,
        };
      } catch (error) {
        console.error('SQL query error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    // TODO: consider experimental_toToolResultContent() for returning Arrow
  }),

  // answer tool: the LLM will provide a structured answer
  answer: tool({
    description: 'A tool for providing the final answer.',
    parameters: AnalysisAnswerSchema,
  }),
};
