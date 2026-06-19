import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {MAP_TOOL_KEY} from '../constants';
import type {
  CreateDashboardAgentToolOptions,
  DashboardAgentResult,
} from './dashboard-types';
import {AiAgentError} from '../errors';
import {ensureTable, calculateAgentResultMetadata} from '../tool-helpers';
import {createDashboardAiTools} from './createDashboardAiTools';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';
import {createDashboardAiAdapter} from './createDashboardAiAdapter';
import {resolveChartTypes} from '../../charts/chart-types/resolveChartTypes';
import {createChartToolsInstructions} from '../../charts/chart-types/createChartInstructions';
import {DASHBOARD_CHART_TOOL_PREFIX, KnownDashboardTools} from './constants';

function getDashboardAgentInstructions<TState>(
  options: CreateDashboardAgentToolOptions<TState>,
): string {
  const chartTools = resolveChartTypes(options.chartToolsOptions?.chartTypes);

  const chartToolsInstructions = createChartToolsInstructions(
    chartTools,
    DASHBOARD_CHART_TOOL_PREFIX,
  );

  return `
You are a dashboard builder AI agent that creates dashboard.

## Your Role

You create DASHBOARD contains multiple panel including:
- Chart panel
- Data Table Explorer panel
- Map panel (if provided by the host app)

You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

## Dataset

Dashboard always requires a **tableName** parameter to specify the dataset to analyze. 
You can use the query tool to explore the data and discover patterns, then create panels based on your findings.

## Available Tools

**Chart Tools:**
${chartToolsInstructions}

**Panel Tools:**
- ${KnownDashboardTools.create_dashboard_panel_data_table_explorer} - table statistics and column summaries
- ${MAP_TOOL_KEY} - native Deck JSON geospatial map panel (if provided by the host app)

**Data Tools:**
- query - execute SQL queries for data exploration

## Workflows

### Direct Requests
When user provides specific instructions:
1. Parse intent -> identify panel type
2. Call appropriate tool with settings
3. Done

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
3. Stop when dashboard tells coherent story

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
- **Validate columns:** Query tools will validate column existence and types
- **Handle errors gracefully:** If a query or chart creation fails, try alternative approach`;
}

const DashboardAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the dashboard agent is being called'),
  prompt: z
    .string()
    .describe('The exploratory data analysis prompt for the agent'),
  tableName: z.string().describe('The name of the table/dataset to analyze.'),
  dashboardId: z
    .string()
    .describe('The ID of an existing dashboard to update.'),
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

/**
 * Creates an AI agent tool for populating dashboards with charts and interactive panels.
 * The agent explores data through queries and creates multiple panels showing different aspects.
 *
 * @template TState - Store state type extending MosaicDashboardStoreState
 * @param options - Configuration options for the dashboard agent
 * @param options.store - Zustand store instance for state management
 * @param options.databaseAdapter - Adapter for database operations and queries
 * @param options.chartToolsOptions - Optional chart configuration and type restrictions
 * @param options.extraTools - Optional factory for additional custom tools (e.g., map panels)
 * @returns Tool instance that orchestrates multi-turn dashboard creation via a ToolLoopAgent
 */
export function createDashboardAgentTool<
  TState extends MosaicDashboardStoreState,
>(options: CreateDashboardAgentToolOptions<TState>): Tool {
  const {store, databaseAdapter, chartToolsOptions, extraTools} = options;

  return tool({
    description: `An AI agent that populates a dashboard with charts and interactive panels.

This agent:
- Queries the data to discover patterns and insights
- Creates charts (histograms, scatter plots, heatmaps, box plots, etc.)
- Adds Data Table Explorer panels for tabular analysis
- Builds interactive dashboards for data exploration

REQUIRED PARAMETERS:
- dashboardId: The ID of the dashboard to populate
- tableName: The dataset to analyze
- prompt: What insights, patterns, or specific charts to create

The agent will explore the data and create 3-5 panels showing different aspects based on the prompt.

IMPORTANT: IF primary artefact in run context is a dashboard, prioritize using this tool for any queries or data analysis tasks.`,
    inputSchema: DashboardAgentInputSchema,
    execute: async (params, toolOptions): Promise<DashboardAgentResult> => {
      const {prompt, tableName, dashboardId, maxSteps, temperature} = params;

      const dashboardAdapter = createDashboardAiAdapter(store, dashboardId);

      try {
        const state = store.getState();

        ensureTable(databaseAdapter, tableName);

        dashboardAdapter.setSelectedTable(tableName);

        const dataTools = options.createDataTools?.({store}) ?? {};

        const agent = new ToolLoopAgent({
          model: options.getModel({state}),
          tools: {
            ...dataTools,
            ...createDashboardAiTools({
              dashboardAdapter,
              databaseAdapter,
              chartToolsOptions,
              extraTools,
            }),
          },
          temperature: Math.max(0, Math.min(1, temperature ?? 0.7)),
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions:
            options.instructions ?? getDashboardAgentInstructions(options),
        });

        const result = await options.runSubAgent({
          agent,
          prompt,
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const metadata = calculateAgentResultMetadata(
          tableName,
          result.agentToolCalls,
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
