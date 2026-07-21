import {z} from 'zod';
import {tool} from 'ai';
import type {StoreApi} from '@sqlrooms/room-store';

interface DbState {
  db: {
    connector: {query: (sql: string) => Promise<{toArray: () => Record<string, unknown>[]}>;};
    tables: Array<{tableName: string; columns: Array<{name: string; type: string}>}>;
    refreshTableSchemas: () => Promise<unknown>;
  };
}

export type ExecuteApiOutput = {
  success: boolean;
  apiName: string;
  details?: string;
  error?: string;
  numRows?: number;
  tableName?: string;
  firstRows?: unknown[];
  /**
   * Chart payload from the `createChart` apiName. `vegaLiteSpec` is the parsed
   * spec (data omitted) and `sqlQuery` supplies the data at render time. The
   * `executeApi` tool renderer draws these via `VegaChartToolResult`. Without
   * surfacing them, charts created in skill mode would never render.
   */
  sqlQuery?: string;
  vegaLiteSpec?: Record<string, unknown>;
  reasoning?: string;
};

type AppStore = StoreApi<DbState>;

/**
 * DuckDB returns integer columns (e.g. COUNT(*)) as native BigInt, which
 * JSON.stringify cannot serialize. That crash silently breaks both the model
 * output and session persistence — so a created chart never renders. Normalize
 * BigInt to number (or string when it exceeds the safe integer range) before
 * any value leaves this module.
 */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        toJsonSafe(v),
      ]),
    );
  }
  return value;
}

function toJsonSafeRows(rows: Record<string, unknown>[]): unknown[] {
  return rows.map((r) => toJsonSafe(r));
}

const ExecuteCommandArgs = z.object({
  commandId: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
});

const CreateChartArgs = z.object({
  sqlQuery: z.string(),
  vegaLiteSpec: z.string(),
  reasoning: z.string().optional(),
});

const ExecuteApiCall = z.discriminatedUnion('apiName', [
  z.object({apiName: z.literal('executeCommand'), args: ExecuteCommandArgs}),
  z.object({apiName: z.literal('createChart'), args: CreateChartArgs}),
]);

const EXECUTE_API_GUIDANCE = `Execute application commands and create visualizations.
Always call as: { call: { apiName: "<name>", args: { ...typed args... } }, reasoning: "<why>" }. Pass call as an object, NOT a stringified JSON.

- executeCommand: Execute an application command by id. Args: commandId and optional input.
  Well-known commands:
  - "data.query": Run a DuckDB SQL query. input: { sqlQuery, saveToTable?, numFirstRowsToLLM? }. Returns { numRows, tableName?, firstRows? }.

- createChart: Create a Vega-Lite chart. Args: { sqlQuery, vegaLiteSpec, reasoning? }. sqlQuery supplies the data; vegaLiteSpec is a stringified Vega-Lite spec (omit the data field). Returns { details }.`;

async function handleDataQuery(
  store: AppStore,
  input: Record<string, unknown>,
): Promise<ExecuteApiOutput> {
  const sqlQuery = input.sqlQuery as string;
  const saveToTable = input.saveToTable as string | undefined;
  const numFirstRowsToLLM = (input.numFirstRowsToLLM as number) ?? 5;

  if (!sqlQuery) {
    return {success: false, apiName: 'executeCommand', error: 'Missing sqlQuery'};
  }

  try {
    const connector = store.getState().db.connector;
    let effectiveQuery = sqlQuery;
    if (saveToTable) {
      effectiveQuery = `CREATE OR REPLACE TABLE ${saveToTable} AS (${sqlQuery})`;
      await connector.query(effectiveQuery);
      const countResult = await connector.query(`SELECT COUNT(*) as cnt FROM ${saveToTable}`);
      const rows = countResult.toArray();
      const numRows = Number(rows[0]?.cnt ?? 0);

      let firstRows: unknown[] | undefined;
      if (numFirstRowsToLLM > 0) {
        const preview = await connector.query(
          `SELECT * FROM ${saveToTable} LIMIT ${numFirstRowsToLLM}`,
        );
        firstRows = toJsonSafeRows(preview.toArray());
      }

      store.getState().db.refreshTableSchemas();
      return {
        success: true,
        apiName: 'executeCommand',
        details: `Saved ${numRows} rows to table "${saveToTable}"`,
        numRows,
        tableName: saveToTable,
        firstRows,
      };
    }

    const result = await connector.query(effectiveQuery);
    const allRows = result.toArray();
    const numRows = allRows.length;
    const firstRows = toJsonSafeRows(allRows.slice(0, numFirstRowsToLLM));

    return {
      success: true,
      apiName: 'executeCommand',
      details: `Query returned ${numRows} rows`,
      numRows,
      firstRows,
    };
  } catch (error) {
    return {
      success: false,
      apiName: 'executeCommand',
      error: `SQL error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function handleCreateChart(
  store: AppStore,
  args: {sqlQuery: string; vegaLiteSpec: string; reasoning?: string},
): Promise<ExecuteApiOutput> {
  const {sqlQuery, vegaLiteSpec, reasoning} = args;

  let parsedSpec: Record<string, unknown>;
  try {
    const parsed = JSON.parse(vegaLiteSpec);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        success: false,
        apiName: 'createChart',
        error: 'vegaLiteSpec must be a JSON object.',
      };
    }
    if (!parsed.mark && !parsed.layer) {
      return {
        success: false,
        apiName: 'createChart',
        error: 'vegaLiteSpec must contain at least a "mark" (or "layer") property.',
      };
    }
    parsedSpec = parsed as Record<string, unknown>;
  } catch (error) {
    return {
      success: false,
      apiName: 'createChart',
      error: `vegaLiteSpec is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    const connector = store.getState().db.connector;
    const result = await connector.query(sqlQuery);
    const numRows = result.toArray().length;
    if (numRows === 0) {
      return {
        success: false,
        apiName: 'createChart',
        error: 'SQL query returned no rows. Fix the sqlQuery and try again.',
      };
    }
    // Return the parsed spec + sqlQuery so the executeApi renderer can draw the
    // chart in the conversation. Without these surfaced, the chart silently
    // never renders even though the call "succeeds".
    return {
      success: true,
      apiName: 'createChart',
      details: `Created chart with ${numRows} data points`,
      numRows,
      sqlQuery,
      vegaLiteSpec: parsedSpec,
      reasoning,
    };
  } catch (error) {
    return {
      success: false,
      apiName: 'createChart',
      error: `Chart query failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create the executeApi tool that skill sub-agents use to interact with
 * the application (run queries and create charts).
 */
export function createExecuteApiTool(store: AppStore) {
  return tool({
    description: EXECUTE_API_GUIDANCE,
    inputSchema: z.preprocess(
      (val) => {
        if (typeof val === 'object' && val !== null && 'call' in val) return val;
        return val;
      },
      z.object({
        call: ExecuteApiCall,
        reasoning: z.string().optional().default(''),
      }),
    ),
    execute: async ({call}): Promise<ExecuteApiOutput> => {
      if (call.apiName === 'createChart') {
        return handleCreateChart(store, call.args);
      }

      const {commandId, input = {}} = call.args;

      switch (commandId) {
        case 'data.query':
          return handleDataQuery(store, input);
        default:
          return {success: false, apiName: 'executeCommand', error: `Unknown command: ${commandId}`};
      }
    },
    toModelOutput: ({output}) => {
      const modelResult: Record<string, unknown> = {success: output.success};
      if (output.details) modelResult.details = output.details;
      if (output.error) modelResult.error = output.error;
      if (output.numRows != null) modelResult.numRows = output.numRows;
      if (output.tableName != null) modelResult.tableName = output.tableName;
      if (output.firstRows != null) modelResult.firstRows = output.firstRows;
      return {type: 'text' as const, value: JSON.stringify(toJsonSafe(modelResult))};
    },
  });
}

export type ExecuteApiTool = ReturnType<typeof createExecuteApiTool>;
