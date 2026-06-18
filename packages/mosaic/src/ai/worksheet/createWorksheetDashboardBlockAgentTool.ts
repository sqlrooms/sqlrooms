import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {MAP_TOOL_KEY} from '../constants';
import type {
  DashboardAgentResult,
  BaseAgentToolOptions,
  WorksheetAiAdapter,
  DashboardAiAdapter,
} from '../types';
import {AiAgentError} from '../errors';
import {ensureTable} from '../tool-helpers';
import {createDashboardAiTools} from '../dashboard/createDashboardAiTools';
import {StoreApi} from '@sqlrooms/room-store';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';

const DASHBOARD_AGENT_INSTRUCTIONS = `You are a dashboard block builder agent that creates interactive dashboard blocks within worksheets.

## Your Role

You create DASHBOARD BLOCKS that are embedded in worksheets as stateful blocks. Each dashboard block contains multiple visualizations (charts, Data Table Explorers) analyzing a specific dataset. You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

## Available Tools

**Chart Tools:**
- create_dashboard_panel_histogram - distribution of numeric values (always safe, aggregates automatically)
- create_dashboard_panel_line_chart - trends over time or ordered variable (use with aggregations for >10k rows)
- create_dashboard_panel_box_plot - compare distributions across categories
- create_dashboard_panel_scatter_plot - relationship between two numeric columns (avoid for >10k rows, use heatmap instead)
- create_dashboard_panel_count_plot - frequency of categorical values (always safe, aggregates automatically)
- create_dashboard_panel_heatmap - density/patterns across two dimensions (preferred for large datasets)

**Panel Tools:**
- create_dashboard_data_table_explorer - table statistics and column summaries
- ${MAP_TOOL_KEY} - native Deck JSON geospatial map panel (if provided by the host app)

**Data Tools:**
- query - execute SQL queries for data exploration

**Management Tools:**
- list_dashboard_panels - discover panel IDs and what's on the dashboard
- remove_dashboard_panel - delete a panel by ID

## Context

You are building a dashboard BLOCK within a WORKSHEET. The dashboard block is a stateful, interactive component embedded in the worksheet alongside other blocks (text, charts, etc.). Your goal is to populate this dashboard block with multiple panels that provide comprehensive insights into the specified dataset.

## Workflows

### Direct Requests
When user provides specific instructions:
1. Parse intent -> identify chart type
2. Call appropriate tool with settings
3. Done

Example: "create histogram of magnitude with 20 bins"
-> create_dashboard_panel_histogram(settings: {field: "magnitude", bins: 20})

### Exploratory Requests
When user asks to discover insights:
1. Use query tool to explore data:
   - Start with simple stats: COUNT, MIN, MAX, AVG, DISTINCT (check total row count!)
   - Check distributions: GROUP BY with COUNT
   - Find correlations: CORR(col1, col2)
   - Identify outliers and patterns
2. Create targeted panels based on discoveries:
   - Create 3-5 panels showing different aspects of the data
   - If dataset has >10k rows: avoid scatter charts and unaggregated line charts
   - Use histogram, count plot, heatmap, or aggregated visualizations instead
3. Stop when dashboard block tells coherent story

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

- **Avoid unaggregated charts for large datasets:** For datasets >10k rows, DO NOT use scatter charts or line charts without aggregations. Use aggregated alternatives instead:
  - For scatter plots: use heatmap or binned aggregations
  - For line charts: use GROUP BY with time buckets or aggregations
  - Histograms and count plots are always safe (they aggregate automatically)
- **Check before update:** Always call list_dashboard_panels before updating/removing panels
- **Repair broken charts:** list_dashboard_panels may return an \`issue\` per panel. For \`too-much-data\`, switch to an aggregated chart or add aggregation. For \`sql-error\`, inspect available columns/types and update the broken panel in place.
- **Validate columns:** Query tools will validate column existence and types
- **Handle errors gracefully:** If a query or chart creation fails, try alternative approach`;

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

// function calculateAgentMetadata(
//   adapter: DashboardAiAdapter,
//   dashboardId: string,
//   tableName: string,
//   agentToolCalls: AgentToolCall[],
// ): DashboardAgentResult['metadata'] {
//   const dashboard = adapter.getDashboard(dashboardId);
//   return {
//     tableName,
//     panelsCreated: dashboard?.panels?.length || 0,
//     stepsExecuted: agentToolCalls.length,
//     queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
//       .length,
//   };
// }

export type CreateWorksheetDashboardBlockAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    worksheetId: string;
    adapter: WorksheetAiAdapter;
  };

export function createWorksheetDashboardBlockAgentTool<TState>(
  options: CreateWorksheetDashboardBlockAgentToolOptions<TState>,
): Tool {
  const {store, adapter, worksheetId} = options;

  return tool({
    description: `An AI agent that adds DASHBOARD BLOCKS to worksheets with multiple visualizations.

Use this to:
- Add an interactive dashboard block to a worksheet: "add dashboard analyzing sales data"
- Create exploratory analysis as a dashboard block: "create insights dashboard for earthquakes dataset"

The agent creates a stateful dashboard block within the worksheet, queries the data, discovers patterns, and populates the dashboard with charts and Data Table Explorers.

Output: A dashboard block embedded in the worksheet with multiple interactive panels.

REQUIRED: Always provide tableName parameter - the dataset the dashboard will analyze.`,
    inputSchema: DashboardAgentInputSchema,
    execute: async (params, toolOptions): Promise<DashboardAgentResult> => {
      const {prompt, tableName, dashboardTitle, maxSteps, temperature} = params;

      const {dashboardId, blockId} = adapter.addDashboardBlock(
        worksheetId,
        dashboardTitle || 'New Dashboard',
        tableName,
      );

      const dashboardAdapter = createDashboardAiAdapter(store, dashboardId);

      try {
        const state = store.getState();

        ensureTable(adapter, tableName);

        const queryTools = options.createQueryTools?.({store});

        const dashboardAgent = new ToolLoopAgent({
          model: options.getModel({state}),
          tools: {
            ...(queryTools ? {query: queryTools.query} : {}),
            ...createDashboardAiTools({
              adapter: dashboardAdapter,
              dashboardId,
              chartTypes: options.chartTypes,
            }),
          },
          temperature: Math.max(0, Math.min(1, temperature ?? 0.7)),
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions: options.instructions ?? DASHBOARD_AGENT_INSTRUCTIONS,
        });

        const result = await options.runSubAgent({
          agent: dashboardAgent,
          prompt,
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        // const metadata = calculateAgentMetadata(
        //   adapter,
        //   dashboardId,
        //   tableName,
        //   result.agentToolCalls || [],
        // );

        return {
          success: true,
          finalOutput: result.finalOutput || 'Dashboard created successfully.',
          dashboardId,
          // metadata,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        const friendlyMessage =
          error instanceof AiAgentError
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

export function createDashboardAiAdapter(
  store: StoreApi<MosaicDashboardStoreState>,
  dashboardId: string,
): DashboardAiAdapter {
  return {
    addPanel: (panel) =>
      store.getState().mosaicDashboard.addPanel(dashboardId, panel),
    findTable: (tableName) => store.getState().db.findTable(tableName),
  } as DashboardAiAdapter;
}
