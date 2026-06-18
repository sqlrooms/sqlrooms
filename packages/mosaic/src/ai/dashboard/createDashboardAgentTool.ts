import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {createDashboardAiTools} from './createDashboardAiTools';
import {MAP_TOOL_KEY} from '../constants';
import type {
  DashboardAiAdapter,
  CreateDashboardAgentToolOptions,
  DashboardAgentResult,
  AgentToolCall,
} from '../types';
import {AiAgentError} from '../errors';
import {ensureTable} from '../tool-helpers';

const DASHBOARD_AGENT_INSTRUCTIONS = `You are a dashboard builder agent that creates and modifies interactive data dashboards.

## Your Role

You analyze data and create insightful dashboards with multiple visualizations (charts, Data Table Explorers). You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

## Available Tools

**Chart Tools:**
- create_dashboard_histogram - distribution of numeric values (always safe, aggregates automatically)
- create_dashboard_line_chart - trends over time or ordered variable (use with aggregations for >10k rows)
- create_dashboard_box_plot - compare distributions across categories
- create_dashboard_scatter_plot - relationship between two numeric columns (avoid for >10k rows, use heatmap instead)
- create_dashboard_count_plot - frequency of categorical values (always safe, aggregates automatically)
- create_dashboard_heatmap - density/patterns across two dimensions (preferred for large datasets)

**Panel Tools:**
- create_dashboard_data_table_explorer - table statistics and column summaries
- ${MAP_TOOL_KEY} - native Deck JSON geospatial map panel (if provided by the host app)

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
   - If dataset has >10k rows: avoid scatter charts and unaggregated line charts
   - Use histogram, count plot, heatmap, or aggregated visualizations instead
3. Stop when dashboard tells coherent story

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

function buildAgentPrompt(
  userPrompt: string,
  tableName: string,
  adapter: DashboardAiAdapter,
): string {
  const table = adapter
    .getTables()
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

function getOrCreateDashboard(
  adapter: DashboardAiAdapter,
  tableName: string,
  dashboardTitle?: string,
): string {
  const dashboardId = adapter.getCurrentDashboardArtifactId();
  if (dashboardId) {
    adapter.ensureDashboard(dashboardId);
    return dashboardId;
  }

  const suggestedTitle =
    dashboardTitle ||
    `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Insights`;
  const newDashboardId = adapter.createDashboardArtifact(
    suggestedTitle,
    'grid',
  );
  adapter.setCurrentArtifact(newDashboardId);
  return newDashboardId;
}

function calculateAgentMetadata(
  adapter: DashboardAiAdapter,
  dashboardId: string,
  tableName: string,
  agentToolCalls: AgentToolCall[],
): DashboardAgentResult['metadata'] {
  const dashboard = adapter.getDashboard(dashboardId);
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

The agent will query the data, discover patterns, and create charts and Data Table Explorers with findings.

IMPORTANT: Always provide tableName parameter when the user mentions a specific dataset.`,
    inputSchema: DashboardAgentInputSchema,
    execute: async (params, toolOptions): Promise<DashboardAgentResult> => {
      const {prompt, tableName, dashboardTitle, maxSteps, temperature} = params;

      let dashboardId = '';

      try {
        const state = store.getState();

        ensureTable(adapter, tableName);

        dashboardId = getOrCreateDashboard(adapter, tableName, dashboardTitle);
        adapter.setSelectedTable(dashboardId, tableName);
        const queryTools = options.createQueryTools?.({store});

        const dashboardAgent = new ToolLoopAgent({
          model: options.getModel({state}),
          tools: {
            ...(queryTools ? {query: queryTools.query} : {}),
            ...createDashboardAiTools({
              adapter,
              dashboardId,
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
          prompt: buildAgentPrompt(prompt, tableName, adapter),
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const metadata = calculateAgentMetadata(
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
