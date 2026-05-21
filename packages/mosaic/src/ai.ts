/**
 * Reusable AI helpers for Mosaic dashboards.
 *
 * Host apps provide a narrow adapter for their store/artifact model; Mosaic owns
 * the dashboard tool behavior and prompts.
 *
 * @packageDocumentation
 */

import {
  type LanguageModel,
  type Tool,
  ToolLoopAgent,
  stepCountIs,
  tool,
} from 'ai';
import {z} from 'zod';
import {
  createChartTools,
  createDefaultChartTypes,
  createListPanelsTool,
  createProfilerTool,
  createRemovePanelTool,
  createTextPanelTool,
  type ChartBuilderColumn,
  type ChartToolExecutionContext,
  type DashboardToolDeps,
  type PanelPatch,
  type ChartTypeDefinition,
} from './chart-types';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from './dashboard/dashboard-types';
import type {MosaicDashboardLayoutType} from './dashboard/core-types';
import {MAX_DATA_POINTS} from './MosaicSlice';

export type {ChartToolExecutionContext} from './chart-types';

export type DashboardAiStore<TState> = {
  getState: () => TState;
};

export type DashboardAiTable = {
  tableName: string;
  columns?: ChartBuilderColumn[];
  rowCount?: number;
};

export type DashboardAiAdapter<TState> = {
  getTables: (state: TState) => DashboardAiTable[];
  hasRunContext?: (
    state: TState,
    context?: ChartToolExecutionContext,
  ) => boolean;
  resolveContextDashboardArtifactId?: (
    state: TState,
    context?: ChartToolExecutionContext,
  ) => string | undefined;
  makeDashboardPrimaryForRun?: (
    state: TState,
    dashboardId: string,
    context?: ChartToolExecutionContext,
  ) => void;
  getCurrentDashboardArtifactId: (state: TState) => string | undefined;
  createDashboardArtifact: (
    state: TState,
    title?: string,
    layoutType?: MosaicDashboardLayoutType,
  ) => string;
  isDashboardArtifact: (state: TState, artifactId: string) => boolean;
  setCurrentArtifact: (state: TState, artifactId: string) => void;
  ensureDashboard: (
    state: TState,
    dashboardId: string,
    title?: string,
    layoutType?: MosaicDashboardLayoutType,
  ) => void;
  getDashboard: (
    state: TState,
    dashboardId: string,
  ) => MosaicDashboardEntry | undefined;
  setSelectedTable: (
    state: TState,
    dashboardId: string,
    tableName: string,
  ) => void;
  addPanel: (
    state: TState,
    dashboardId: string,
    panel: MosaicDashboardPanelConfig,
  ) => string;
  updatePanel: (
    state: TState,
    dashboardId: string,
    panelId: string,
    patch: Partial<PanelPatch>,
  ) => void;
  removePanel: (state: TState, dashboardId: string, panelId: string) => void;
};

export type CreateDashboardToolDepsOptions<TState> = {
  store: DashboardAiStore<TState>;
  adapter: DashboardAiAdapter<TState>;
};

export type CreateDashboardAiToolsOptions<TState> =
  CreateDashboardToolDepsOptions<TState> & {
    chartTypes?: ChartTypeDefinition<any>[];
    extraTools?: (deps: DashboardToolDeps) => Record<string, Tool>;
  };

export type DashboardAgentToolCall = {
  toolName: string;
};

export type DashboardAgentRunResult = {
  finalOutput?: string;
  agentToolCalls?: DashboardAgentToolCall[];
};

export type DashboardAgentResult = {
  success: boolean;
  finalOutput: string;
  dashboardId: string;
  error?: string;
  metadata?: {
    tableName: string;
    panelsCreated: number;
    stepsExecuted: number;
    queriesRun: number;
  };
};

export type CreateDashboardAgentToolOptions<TState> =
  CreateDashboardToolDepsOptions<TState> & {
    getModel: (args: {state: TState}) => LanguageModel;
    createQueryTools?: (args: {store: DashboardAiStore<TState>}) => {
      query: Tool;
    };
    runSubAgent: (args: {
      agent: ToolLoopAgent<any, any, any>;
      prompt: string;
      store: DashboardAiStore<TState>;
      parentToolCallId: string;
      abortSignal?: AbortSignal;
    }) => Promise<DashboardAgentRunResult>;
    instructions?: string;
    chartTypes?: ChartTypeDefinition<any>[];
    extraTools?: (deps: DashboardToolDeps) => Record<string, Tool>;
  };

export const DASHBOARD_AI_INSTRUCTIONS = `
Dashboard authoring:

**When to use dashboard_agent vs individual tools:**
- Use \`dashboard_agent\` for exploratory requests that require data analysis and discovery:
  - "analyze the earthquakes dataset"
  - "create insights dashboard for sales data"
  - "find interesting patterns in customer behavior"
  - Any request asking to "discover", "explore", "find insights", or "analyze"
- Use individual chart tools for direct, specific requests:
  - "create histogram of magnitude with 20 bins"
  - "add a line chart showing sales over time"
  - "update the histogram to use 30 bins"

**Individual dashboard chart tools:**
- create_dashboard_histogram, create_dashboard_line_chart, create_dashboard_box_plot, create_dashboard_bubble_chart, create_dashboard_count_plot, create_dashboard_heatmap
- Each chart type has its own tool with specific parameters.
- For line charts with aggregation, use yFields array with {field: string, aggregate: "sum"|"avg"|"min"|"max"}.
- Set xInterval for temporal binning (year, month, day, hour, etc.).
- If the host app provides \`create_dashboard_map\`, use it for map/geospatial/location requests and tables with longitude/latitude or geometry columns.
- Use \`set_dashboard_vgplot\` with complete JSON only when no chart tool fits your needs.
- When calling \`create_dashboard_artifact\`, \`layoutType\` may be \`grid\` or \`dock\`; omitted values default to \`grid\`.
- Ensure specs are valid JSON objects compatible with https://idl.uw.edu/mosaic/schema/latest.json.
`;

export const DASHBOARD_AGENT_INSTRUCTIONS = `You are a dashboard builder agent that creates and modifies interactive data dashboards.

## Your Role

You analyze data and create insightful dashboards with multiple visualizations (charts, profilers, text annotations). You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

## Available Tools

**Chart Tools:**
- create_dashboard_histogram - distribution of numeric values (always safe, aggregates automatically)
- create_dashboard_line_chart - trends over time or ordered variable (use with aggregations for >10k rows)
- create_dashboard_box_plot - compare distributions across categories
- create_dashboard_bubble_chart - relationship between two numeric columns (avoid for >10k rows, use heatmap instead)
- create_dashboard_count_plot - frequency of categorical values (always safe, aggregates automatically)
- create_dashboard_heatmap - density/patterns across two dimensions (preferred for large datasets)

**Panel Tools:**
- create_dashboard_profiler - table statistics and column summaries
- create_dashboard_text_panel - markdown annotations and insights
- create_dashboard_map - geospatial point map when longitude/latitude or geometry columns are available (if provided by the host app)

**Data Tools:**
- query - execute SQL queries for data exploration

**Management Tools:**
- list_dashboard_panels - discover panel IDs and what's on the dashboard
- remove_dashboard_panel - delete a panel by ID

## Workflows

### Direct Requests
When user provides specific instructions:
1. Parse intent -> identify chart type
2. Call appropriate tool with settings
3. Done

Example: "create histogram of magnitude with 20 bins"
-> create_dashboard_histogram(settings: {field: "magnitude", bins: 20})

### Exploratory Requests
When user asks to discover insights:
1. Use query tool to explore data:
   - Start with simple stats: COUNT, MIN, MAX, AVG, DISTINCT (check total row count!)
   - Check distributions: GROUP BY with COUNT
   - Find correlations: CORR(col1, col2)
   - Identify outliers and patterns
2. Create targeted charts based on discoveries:
   - If dataset has >10k rows: avoid bubble charts and unaggregated line charts
   - Use histogram, count plot, heatmap, or aggregated visualizations instead
3. **ALWAYS create ONE text panel** with a concise summary of ALL key findings
4. Stop when dashboard tells coherent story

**CRITICAL:**
- Create exactly ONE text panel with insights summary (can be first, last, or in between)
- Insights should be concise but USEFUL - each bullet should provide actionable or interesting information
- Include specific numbers, percentages, and comparisons that tell the story
- Use query tool to discover actual patterns, don't make vague statements
- Focus on 3-5 most important findings that answer "what's interesting about this data?"
- Do NOT create additional text panels unless absolutely necessary

**Good insight examples:**
- "Peak activity between 4-5 magnitude (62% of events)" - specific, actionable
- "Strong correlation (0.73) between depth and magnitude suggests tectonic pattern" - specific with interpretation
- "California accounts for 3,234/5,234 events (62%), followed by Japan (18%)" - specific comparison

**Bad insight examples:**
- "Dataset has data" - useless
- "Various magnitudes observed" - vague
- "Interesting patterns found" - not specific

### Update Requests
To update existing panels:
1. Call list_dashboard_panels() to discover panel IDs
2. Call appropriate create tool with panelId parameter
3. Panel is updated in-place

## Query Guidelines

**Keep queries simple:**
- Start with aggregations: COUNT, MIN, MAX, AVG, SUM
- Use GROUP BY for breakdowns and distributions
- Use LIMIT to control result size (especially with GROUP BY)
- Avoid expensive operations: large JOINs, full table scans

**Exploration strategy:**
- Limit exploration to 5-10 queries per request
- Start broad (overall stats), then narrow (specific patterns)
- Stop when you have enough insights for a coherent dashboard

## Best Practices

- **ONE text panel for exploratory requests:** Always create exactly ONE text panel with insights summary when exploring data. It can be created at any point in the workflow.
- **Make insights useful, not just concise:** Each bullet should include specific numbers, percentages, or patterns discovered through queries. Avoid vague statements.
- **Use queries to find real insights:** Run queries to discover actual patterns (correlations, distributions, outliers, top values). Don't make assumptions.
- **No additional text panels:** Do NOT create multiple text panels. All insights go in the single summary panel.
- **Avoid unaggregated charts for large datasets:** For datasets >10k rows, DO NOT use bubble charts or line charts without aggregations. Use aggregated alternatives instead:
  - For scatter/bubble plots: use heatmap or binned aggregations
  - For line charts: use GROUP BY with time buckets or aggregations
  - Histograms and count plots are always safe (they aggregate automatically)
- **Check before update:** Always call list_dashboard_panels before updating/removing panels
- **Validate columns:** Query tools will validate column existence and types
- **Handle errors gracefully:** If a query or chart creation fails, try alternative approach
- **Use markdown formatting:** Use headings (##), bullet lists (-), and **bold** in text panels for readability`;

const DashboardCreateArtifactToolParameters = z.object({
  title: z.string().optional(),
  layoutType: z
    .enum(['dock', 'grid'])
    .optional()
    .default('grid')
    .describe('Dashboard layout node type to use at creation time.'),
});
type DashboardCreateArtifactToolParameters = z.infer<
  typeof DashboardCreateArtifactToolParameters
>;

const DashboardAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the dashboard agent is being called'),
  prompt: z
    .string()
    .describe('The exploratory data analysis prompt for the agent'),
  tableName: z
    .string()
    .describe('REQUIRED: The name of the table/dataset to analyze.'),
  dashboardTitle: z
    .string()
    .optional()
    .describe('Optional title for the dashboard artifact'),
  maxSteps: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum exploration steps (default: 20, range: 5-50)'),
  temperature: z
    .number()
    .optional()
    .default(0.7)
    .describe(
      'Model temperature for creativity vs consistency (default: 0.7, range: 0.0-1.0)',
    ),
});
type DashboardAgentInputSchema = z.infer<typeof DashboardAgentInputSchema>;

class DashboardAgentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardAgentException';
  }
}

function getTablesWithColumns<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
): DashboardAiTable[] {
  return adapter
    .getTables(state)
    .filter((table) => table.columns && table.columns.length > 0);
}

function findTableColumns<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
  tableName: string,
): ChartBuilderColumn[] | null {
  const table = getTablesWithColumns(state, adapter).find(
    (candidate) => candidate.tableName === tableName,
  );
  if (!table?.columns) return null;
  return table.columns.map((column) => ({
    name: column.name,
    type: column.type,
  }));
}

function formatAvailableTables(tables: DashboardAiTable[]): string {
  return tables.map((table) => table.tableName).join(', ') || '(none)';
}

export function createDashboardToolDeps<TState>({
  store,
  adapter,
}: CreateDashboardToolDepsOptions<TState>): DashboardToolDeps {
  const resolveArtifact = (
    artifactId?: string,
    createIfMissing?: boolean,
    context?: ChartToolExecutionContext,
  ): string => {
    const state = store.getState();
    const hasRunContext = adapter.hasRunContext?.(state, context) ?? false;
    const contextDashboardArtifactId =
      adapter.resolveContextDashboardArtifactId?.(state, context);
    let targetArtifactId =
      artifactId ??
      contextDashboardArtifactId ??
      (!hasRunContext
        ? adapter.getCurrentDashboardArtifactId(state)
        : undefined);

    if (!targetArtifactId && hasRunContext) {
      throw new Error(
        'No primary dashboard artifact is available in the current run context. Pass artifactId explicitly or use set_primary_context_artifact first.',
      );
    }

    if (!targetArtifactId && createIfMissing) {
      targetArtifactId = adapter.createDashboardArtifact(
        state,
        undefined,
        'grid',
      );
      adapter.setCurrentArtifact(state, targetArtifactId);
      adapter.makeDashboardPrimaryForRun?.(state, targetArtifactId, context);
    }

    if (!targetArtifactId) {
      throw new Error(
        'No dashboard artifact is available. Set createArtifactIfMissing=true or create one first.',
      );
    }

    if (!adapter.isDashboardArtifact(state, targetArtifactId)) {
      throw new Error(
        `Artifact "${targetArtifactId}" is not a dashboard artifact.`,
      );
    }

    adapter.ensureDashboard(state, targetArtifactId);
    return targetArtifactId;
  };

  const resolveTable = (artifactId: string, tableName?: string) => {
    const state = store.getState();
    const tables = getTablesWithColumns(state, adapter);
    const dashboard = adapter.getDashboard(state, artifactId);
    const explicitTableName = tableName?.trim() || undefined;

    if (explicitTableName) {
      const columns = findTableColumns(state, adapter, explicitTableName);
      if (!columns) {
        throw new Error(
          `Unknown table "${explicitTableName}". Available tables: ${formatAvailableTables(tables)}.`,
        );
      }
      adapter.setSelectedTable(state, artifactId, explicitTableName);
      return {tableName: explicitTableName, columns};
    }

    if (dashboard?.selectedTable) {
      const columns = findTableColumns(state, adapter, dashboard.selectedTable);
      if (columns) {
        return {tableName: dashboard.selectedTable, columns};
      }
    }

    if (tables.length === 1) {
      const onlyTable = tables[0];
      if (!onlyTable?.columns) {
        throw new Error('The only available table has no column metadata.');
      }
      adapter.setSelectedTable(state, artifactId, onlyTable.tableName);
      return {
        tableName: onlyTable.tableName,
        columns: onlyTable.columns.map((column) => ({
          name: column.name,
          type: column.type,
        })),
      };
    }

    throw new Error(
      `No dashboard table is selected. Provide tableName using one of: ${formatAvailableTables(tables)}.`,
    );
  };

  return {
    maxDataPoints: MAX_DATA_POINTS,
    resolveArtifact,
    resolveTable,
    addPanel: (dashboardId, panel) => {
      const state = store.getState();
      return adapter.addPanel(state, dashboardId, panel);
    },
    updatePanel: (dashboardId, panelId, patch) => {
      const state = store.getState();
      adapter.updatePanel(state, dashboardId, panelId, patch);
    },
    getDashboard: (dashboardId) => {
      const state = store.getState();
      return adapter.getDashboard(state, dashboardId);
    },
    removePanel: (dashboardId, panelId) => {
      const state = store.getState();
      adapter.removePanel(state, dashboardId, panelId);
    },
    setCurrentArtifact: (artifactId) => {
      const state = store.getState();
      adapter.setCurrentArtifact(state, artifactId);
    },
  };
}

export function createDashboardAiTools<TState>({
  store,
  adapter,
  chartTypes,
  extraTools,
}: CreateDashboardAiToolsOptions<TState>): Record<string, Tool> {
  const deps = createDashboardToolDeps({store, adapter});
  const resolvedChartTypes =
    chartTypes ?? createDefaultChartTypes({includeCustomSpec: false});
  const chartTools = createChartTools(resolvedChartTypes, deps);
  const hostTools = extraTools?.(deps) ?? {};

  return {
    create_dashboard_artifact: tool({
      description:
        'Create a new dashboard artifact with a dock or grid layout and make it the active artifact. Use when no dashboard artifact exists yet.',
      inputSchema: DashboardCreateArtifactToolParameters,
      execute: async (
        params: DashboardCreateArtifactToolParameters,
        context,
      ) => {
        const state = store.getState();
        const artifactId = adapter.createDashboardArtifact(
          state,
          params.title,
          params.layoutType,
        );
        adapter.setCurrentArtifact(state, artifactId);
        adapter.makeDashboardPrimaryForRun?.(state, artifactId, context);
        return {
          llmResult: {
            success: true,
            details: `Created dashboard artifact "${artifactId}".`,
            data: {artifactId},
          },
        };
      },
    }),
    ...chartTools,
    create_dashboard_profiler: createProfilerTool(deps),
    create_dashboard_text_panel: createTextPanelTool(deps),
    list_dashboard_panels: createListPanelsTool(deps),
    remove_dashboard_panel: createRemovePanelTool(deps),
    ...hostTools,
  };
}

function buildAgentPrompt<TState>(
  userPrompt: string,
  tableName: string,
  state: TState,
  adapter: DashboardAiAdapter<TState>,
): string {
  const table = adapter
    .getTables(state)
    .find((candidate) => candidate.tableName === tableName);
  const columnNames =
    table?.columns?.map((column) => column.name).join(', ') || 'unknown';
  const rowInfo =
    table?.rowCount !== undefined ? `Approximate rows: ${table.rowCount}` : '';

  return `Analyze the "${tableName}" table.

Table info:
- Columns: ${columnNames}${rowInfo ? `\n- ${rowInfo}` : ''}

User request: ${userPrompt}

Focus on discovering meaningful patterns and creating visualizations that tell a clear story.`;
}

function validateTableExists<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
  tableName: string,
): void {
  const tables = adapter.getTables(state);
  const table = tables.find((candidate) => candidate.tableName === tableName);
  if (!table) {
    throw new DashboardAgentException(
      `Table "${tableName}" not found. Available tables: ${formatAvailableTables(tables)}`,
    );
  }
}

function getOrCreateDashboard<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
  tableName: string,
  dashboardTitle?: string,
): string {
  const dashboardId = adapter.getCurrentDashboardArtifactId(state);
  if (dashboardId) {
    adapter.ensureDashboard(state, dashboardId);
    return dashboardId;
  }

  const suggestedTitle =
    dashboardTitle ||
    `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Insights`;
  const newDashboardId = adapter.createDashboardArtifact(
    state,
    suggestedTitle,
    'grid',
  );
  adapter.setCurrentArtifact(state, newDashboardId);
  return newDashboardId;
}

function calculateAgentMetadata<TState>(
  state: TState,
  adapter: DashboardAiAdapter<TState>,
  dashboardId: string,
  tableName: string,
  agentToolCalls: DashboardAgentToolCall[],
): DashboardAgentResult['metadata'] {
  const dashboard = adapter.getDashboard(state, dashboardId);
  return {
    tableName,
    panelsCreated: dashboard?.panels?.length || 0,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}

export function createDashboardAgentTool<TState>(
  options: CreateDashboardAgentToolOptions<TState>,
): Tool {
  const {store, adapter} = options;

  return tool({
    description: `An AI agent that explores datasets and creates comprehensive dashboards with multiple visualizations.

Use this for exploratory data analysis tasks like "analyze the earthquakes dataset" or "create insights dashboard for sales data".

The agent will query the data, discover patterns, and create charts, profilers, and text panels with findings.

For simple tasks like "create a histogram of magnitude", use the individual chart tools instead.

IMPORTANT: Always provide tableName parameter when the user mentions a specific dataset.`,
    inputSchema: DashboardAgentInputSchema,
    execute: async (params, toolOptions): Promise<DashboardAgentResult> => {
      const {prompt, tableName, dashboardTitle, maxSteps, temperature} = params;

      let dashboardId = '';

      try {
        const state = store.getState();
        validateTableExists(state, adapter, tableName);

        dashboardId = getOrCreateDashboard(
          state,
          adapter,
          tableName,
          dashboardTitle,
        );
        adapter.setSelectedTable(state, dashboardId, tableName);
        const queryTools = options.createQueryTools?.({store});

        const dashboardAgent = new ToolLoopAgent({
          model: options.getModel({state}),
          tools: {
            ...(queryTools ? {query: queryTools.query} : {}),
            ...createDashboardAiTools({
              store,
              adapter,
              chartTypes: options.chartTypes,
              extraTools: options.extraTools,
            }),
          },
          temperature: Math.max(0, Math.min(1, temperature ?? 0.7)),
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions: options.instructions ?? DASHBOARD_AGENT_INSTRUCTIONS,
        });

        const result = await options.runSubAgent({
          agent: dashboardAgent,
          prompt: buildAgentPrompt(prompt, tableName, state, adapter),
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const finalState = store.getState();
        const metadata = calculateAgentMetadata(
          finalState,
          adapter,
          dashboardId,
          tableName,
          result.agentToolCalls || [],
        );

        return {
          success: true,
          finalOutput: result.finalOutput || 'Dashboard created successfully.',
          dashboardId,
          metadata,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const friendlyMessage =
          error instanceof DashboardAgentException
            ? errorMessage
            : 'Dashboard agent execution failed.';

        return {
          success: false,
          finalOutput: friendlyMessage,
          dashboardId,
          error: errorMessage,
        };
      }
    },
  });
}
