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
  breaks?: number[];
  uniqueValues?: string[];
  layerId?: string;
  mapId?: string;
  dateTimeColumns?: string[];
  chartId?: string;
};

type AppStore = StoreApi<DbState>;

let mapCounter = 0;
let chartCounter = 0;

const ExecuteCommandArgs = z.object({
  commandId: z.string(),
  input: z.record(z.unknown()).optional(),
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
  - "map.create-layer": Create a Kepler.gl map layer. input: { tableName, layerType, layerName?, colorBy?, colorType?, colorMap?, simpleColor?, centerMap?, trailLength?, fadeTrail?, mapId? }. Returns { details, layerId, mapId, dateTimeColumns? }.
  - "map.add-time-filter": Add time animation. input: { tableName, dateTimeColumn, interval?, mapId? }.
  - "data.classify": Classify a column for color mapping. input: { datasetName, variableName, method, k? }. Returns { breaks? } or { uniqueValues? }.

- createChart: Create a Vega-Lite chart. Args: { sqlQuery, vegaLiteSpec, reasoning? }. Returns { details, chartId }.`;

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
        firstRows = preview.toArray().map((r: Record<string, unknown>) => ({...r}));
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
    const firstRows = allRows
      .slice(0, numFirstRowsToLLM)
      .map((r: Record<string, unknown>) => ({...r}));

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

function handleMapCreateLayer(input: Record<string, unknown>): ExecuteApiOutput {
  const mapId = (input.mapId as string) || `map-${++mapCounter}`;
  const layerId = `layer-${mapId}-${Date.now()}`;

  return {
    success: true,
    apiName: 'executeCommand',
    details: `Created ${input.layerType || 'point'} layer "${input.layerName || 'Layer'}" on map ${mapId}`,
    layerId,
    mapId,
    dateTimeColumns: undefined,
  };
}

function handleMapAddTimeFilter(input: Record<string, unknown>): ExecuteApiOutput {
  return {
    success: true,
    apiName: 'executeCommand',
    details: `Added time filter on column "${input.dateTimeColumn}" for table "${input.tableName}"`,
    mapId: input.mapId as string | undefined,
  };
}

async function handleDataClassify(
  store: AppStore,
  input: Record<string, unknown>,
): Promise<ExecuteApiOutput> {
  const {datasetName, variableName, method, k = 5} = input as {
    datasetName: string;
    variableName: string;
    method: string;
    k?: number;
  };

  if (!datasetName || !variableName || !method) {
    return {success: false, apiName: 'executeCommand', error: 'Missing datasetName, variableName, or method'};
  }

  try {
    const connector = store.getState().db.connector;

    if (method === 'unique values') {
      const result = await connector.query(
        `SELECT DISTINCT "${variableName}" AS val FROM ${datasetName} WHERE "${variableName}" IS NOT NULL ORDER BY val LIMIT 50`,
      );
      const uniqueValues = result.toArray().map((r: Record<string, unknown>) => String(r.val));
      return {success: true, apiName: 'executeCommand', uniqueValues, details: `Found ${uniqueValues.length} unique values`};
    }

    const result = await connector.query(
      `SELECT "${variableName}" AS val FROM ${datasetName} WHERE "${variableName}" IS NOT NULL ORDER BY val`,
    );
    const values = result.toArray().map((r: Record<string, unknown>) => Number(r.val)).filter((v) => !isNaN(v));

    if (values.length === 0) {
      return {success: false, apiName: 'executeCommand', error: 'No numeric values found'};
    }

    const numBreaks = Math.min(Number(k), values.length - 1);
    const breaks: number[] = [];

    if (method === 'quantile') {
      for (let i = 1; i <= numBreaks; i++) {
        const idx = Math.floor((i / (numBreaks + 1)) * values.length);
        breaks.push(values[idx]);
      }
    } else if (method === 'equal interval') {
      const min = values[0];
      const max = values[values.length - 1];
      const step = (max - min) / (numBreaks + 1);
      for (let i = 1; i <= numBreaks; i++) {
        breaks.push(Math.round((min + step * i) * 100) / 100);
      }
    } else {
      for (let i = 1; i <= numBreaks; i++) {
        const idx = Math.floor((i / (numBreaks + 1)) * values.length);
        breaks.push(values[idx]);
      }
    }

    return {success: true, apiName: 'executeCommand', breaks, details: `Computed ${breaks.length} breaks using ${method}`};
  } catch (error) {
    return {
      success: false,
      apiName: 'executeCommand',
      error: `Classify error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function handleCreateChart(
  store: AppStore,
  args: {sqlQuery: string; vegaLiteSpec: string; reasoning?: string},
): Promise<ExecuteApiOutput> {
  const {sqlQuery, vegaLiteSpec} = args;
  const chartId = `chart-${++chartCounter}`;

  try {
    JSON.parse(vegaLiteSpec);
  } catch {
    return {success: false, apiName: 'createChart', error: 'Invalid vegaLiteSpec JSON'};
  }

  try {
    const connector = store.getState().db.connector;
    const result = await connector.query(sqlQuery);
    const numRows = result.toArray().length;
    return {
      success: true,
      apiName: 'createChart',
      details: `Created chart with ${numRows} data points`,
      chartId,
      numRows,
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
 * the application (run queries, create maps, create charts).
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
        case 'map.create-layer':
          return handleMapCreateLayer(input);
        case 'map.add-time-filter':
          return handleMapAddTimeFilter(input);
        case 'data.classify':
          return handleDataClassify(store, input);
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
      if (output.breaks != null) modelResult.breaks = output.breaks;
      if (output.uniqueValues != null) modelResult.uniqueValues = output.uniqueValues;
      if (output.layerId != null) modelResult.layerId = output.layerId;
      if (output.mapId != null) modelResult.mapId = output.mapId;
      if (output.dateTimeColumns != null) modelResult.dateTimeColumns = output.dateTimeColumns;
      if (output.chartId != null) modelResult.chartId = output.chartId;
      return {type: 'text' as const, value: JSON.stringify(modelResult)};
    },
  });
}

export type ExecuteApiTool = ReturnType<typeof createExecuteApiTool>;
