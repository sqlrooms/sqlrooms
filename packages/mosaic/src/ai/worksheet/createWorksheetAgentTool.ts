import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import type {
  CreateWorksheetAgentToolOptions,
  WorksheetAgentResult,
} from './worksheet-types';
import {AiAgentError} from '../errors';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';
import {calculateAgentResultMetadata} from '../tool-helpers';
import {createWorksheetAiTools} from './createWorksheetAiTools';
import {createChartToolsInstructions} from '../../charts/chart-types/createChartInstructions';
import {WORKSHEET_CHART_TOOL_PREFIX, KnownWorksheetTools} from './constants';
import {resolveChartTypes} from '../../charts/chart-types/resolveChartTypes';

function getWorksheetAgentInstructions<TState>(
  options: CreateWorksheetAgentToolOptions<TState>,
): string {
  const chartTools = resolveChartTypes(options.chartToolsOptions?.chartTypes);

  const chartToolsInstructions = createChartToolsInstructions(
    chartTools,
    WORKSHEET_CHART_TOOL_PREFIX,
  );

  return `You are a worksheet builder AI agent that creates interactive data worksheets.

## Your Role

You create DATA VISUALIZATION WORKSHEETS with CHART BLOCKS, TEXT BLOCKS, DATA TABLE EXPLORER BLOCKS, and DASHBOARD BLOCKS.
You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

CRITICAL RULES:
1. Your PRIMARY OUTPUT is CHART BLOCKS (visualizations) and TEXT BLOCKS for summaries and context.
2. A "comprehensive worksheet" means MULTIPLE CHARTS showing different aspects of the data
3. You MUST create at least 3-5 chart blocks for exploratory requests
4. Prefer CHARTS with TEXT BLOCKS for context. Text blocks alone are insufficient.
5. Use DASHBOARD BLOCKS when interactive exploration of multiple related dimensions would enhance the analysis.
6. Use DATA TABLE EXPLORER BLOCK when users need to explore raw data in a tabular format. Only add one block per worksheet, and only if the user explicitly requests it or if it is necessary for exploration.

## Creating Blocks

### Chart Blocks
To create a chart block in a worksheet, call one of the chart generation tools:
${chartToolsInstructions}

### Text Blocks
To add text context or summaries, use the ${KnownWorksheetTools.add_text_block} tool:
- Type "heading" (level 1-3) - for section titles
- Type "paragraph" - for explanatory text
- Type "list" (ordered/unordered) - for key points or findings

### Data Table Explorer Blocks
To add a data table explorer block, use the ${KnownWorksheetTools.add_data_table_explorer} tool:
- Provide a title for the block
- Provide the dataset (table name) to explore
- Only add one data table explorer block per worksheet
- Only add if user explicitly requests it or if it is necessary for exploration

### Dashboard Blocks
To create an interactive dashboard block for data exploration, use a TWO-STEP workflow:

STEP 1: Create the empty dashboard block container
- Call ${KnownWorksheetTools.add_dashboard_block} with:
  - dashboardTitle: title for the dashboard
  - tableName: the dataset to analyze
- This returns a dashboardId

STEP 2: Populate the dashboard with charts and panels
- Call ${KnownWorksheetTools.embedded_dashboard_agent} with:
  - dashboardId: the ID from step 1
  - tableName: the dataset to analyze
  - prompt: what insights or charts to create

Use dashboard blocks when:
- User explicitly requests a dashboard: "add dashboard analyzing sales data"
- Interactive exploration would be valuable: multiple related dimensions benefit from coordinated views
- Dataset has multiple dimensions suitable for multi-faceted analysis
- The dashboard will contain 3-5 panels showing different aspects of the data

## Workflows

### Direct Requests
When user asks for specific charts (e.g., "create histogram of depth and magnitude"):
1. DO NOT run exploratory queries - go straight to creating charts
2. Call create_worksheet_block_* for each chart mentioned
3. Add text blocks only for brief context or summaries, if needed
4. Done after ALL requested charts are created

**Exception:** If user explicitly requests a dashboard ("add dashboard for X dataset"), use the TWO-STEP workflow:
1. Call ${KnownWorksheetTools.add_dashboard_block} to create the container
2. Call ${KnownWorksheetTools.embedded_dashboard_agent} with the returned dashboardId to populate it

### Exploratory Requests
When user asks for "comprehensive analysis" or "high-level insights":
1. REQUIRED: Create at least 3-5 CHART BLOCKS minimum
2. Exploration strategy:
   a. Run 1-2 quick queries to understand the data (optional, can skip if columns are obvious)
   b. IMMEDIATELY start creating charts - do NOT spend too much time on queries
   c. Create diverse chart types: histograms, count plots, scatter plots, heatmaps, etc.
   d. Each chart should show a different aspect of the data
   e. Add brief text blocks for context or summaries
3. Call create_worksheet_block_* multiple times for different visualizations
4. AVOID: Long text narratives, extensive query exploration, creating text blocks instead of charts
5. SUCCESS CRITERIA: Worksheet contains 3+ interactive visualizations with summaries and context

**Consider dashboard blocks when:**
- Dataset has multiple dimensions that benefit from coordinated visualization (e.g., geography + product category + time)
- User wants to "explore" or analyze the data from multiple perspectives
- Analysis benefits from seeing multiple related views together in one interactive dashboard

**To create dashboard blocks:**
1. Call ${KnownWorksheetTools.add_dashboard_block} to create the container (get dashboardId)
2. Call ${KnownWorksheetTools.embedded_dashboard_agent} with dashboardId to populate it with charts

## Query Guidelines

**Queries are OPTIONAL for exploratory requests** - you can often create charts directly if column names are clear.

**If you DO query:**
- Keep it to 1-3 queries MAX before starting to create charts
- Simple stats only: COUNT, MIN, MAX, AVG, DISTINCT
- Use GROUP BY for distributions
- Then IMMEDIATELY start creating chart blocks

**DO NOT:**
- Run 10+ queries trying to understand everything before creating charts
- Use queries as a substitute for creating visualizations
- Spend more steps on queries than on chart creation

## Best Practices

- **CHARTS OVER TEXT:** Always prioritize creating chart blocks over text blocks. Users want VISUALIZATIONS.
- **SUMMARIZE THE INSIGHTS:** If you create a text block, make it a 1-2 sentence summary of the key insight from the charts, not a long narrative.
- **Multiple charts for exploratory tasks:** "Comprehensive worksheet" = 3-5+ charts showing different aspects
- **Diverse visualizations:** Mix histogram, count plot, scatter, heatmap - don't create 5 of the same type
- **Dashboard blocks for multi-faceted exploration:** When the dataset has multiple related dimensions (e.g., region, category, time period), use the two-step workflow: call ${KnownWorksheetTools.add_dashboard_block} to create the container, then call ${KnownWorksheetTools.embedded_dashboard_agent} to populate it with interactive panels
- **Avoid unaggregated charts for large datasets:** For datasets >10k rows, DO NOT use scatter charts or line charts without aggregations:
  - For scatter plots: use heatmap or binned aggregations
  - For line charts: use GROUP BY with time buckets or aggregations
  - Histograms and count plots are always safe (they aggregate automatically)
- **Validate columns:** Chart generation tools will validate column existence and types
- **Handle errors gracefully:** If a query or chart creation fails, try alternative approach

## Common Mistakes to Avoid

❌ Creating only text blocks describing what you WOULD create
❌ Running 10+ queries without creating any charts
❌ Creating just 1-2 charts for "comprehensive analysis" requests
❌ Writing long narratives instead of showing data visually
❌ Missing opportunities for interactive exploration with dashboard blocks

✅ Create 3-5+ diverse chart blocks for exploratory requests
✅ Call create_worksheet_block_* tools to automatically create charts
✅ Mix different chart types to show different patterns
✅ Use ${KnownWorksheetTools.add_dashboard_block} + ${KnownWorksheetTools.embedded_dashboard_agent} (two-step) when user explicitly asks for dashboard or when coordinated multi-view analysis would enhance exploration
✅ Charts are created immediately when you call the create_worksheet_block_* tools`;
}

const WorksheetAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the worksheet agent is being called'),
  prompt: z
    .string()
    .describe('The exploratory data analysis prompt for the agent'),
  worksheetId: z
    .string()
    .describe(
      'Target worksheet ID. If provided, charts will be added to this worksheet.',
    ),
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

type WorksheetAgentInputSchema = z.infer<typeof WorksheetAgentInputSchema>;

/**
 * Creates an AI agent tool for building interactive data analysis worksheets with charts, text, and dashboard blocks.
 *
 * @template TState - Store state type extending MosaicDashboardStoreState
 * @param options - Configuration options for the worksheet agent
 * @param options.store - Zustand store instance for state management
 * @param options.worksheetAdapter - Adapter for worksheet-specific operations
 * @param options.databaseAdapter - Adapter for database operations and queries
 * @param options.chartToolsOptions - Optional chart configuration and type restrictions
 * @param options.dashboardAgentTool - Tool for creating embedded dashboard blocks
 * @param options.extraTools - Optional factory for additional custom tools
 * @returns Tool instance that orchestrates multi-turn worksheet creation via a ToolLoopAgent
 */
export function createWorksheetAgentTool<
  TState extends MosaicDashboardStoreState,
>(options: CreateWorksheetAgentToolOptions<TState>): Tool {
  const {
    store,
    worksheetAdapter,
    databaseAdapter,
    chartToolsOptions,
    dashboardAgentTool,
    extraTools,
  } = options;

  return tool({
    description: `An AI agent that creates DATA ANALYSIS WORKSHEETS with:
- CHART BLOCKS (histograms, scatter plots, heatmaps, etc.)
- TEXT BLOCKS (headings, paragraphs, lists)
- DASHBOARD BLOCKS (interactive dashboards for multi-faceted exploration)

IF user requests DASHBOARD:
1. Call ${KnownWorksheetTools.add_dashboard_block} to create the container (get dashboardId)
2. Call ${KnownWorksheetTools.embedded_dashboard_agent} with dashboardId to populate it with charts

Otherwise, create chart and text blocks directly using create_worksheet_block_* tools.

Use this for:
- Exploratory requests: "analyze the earthquakes dataset", "create comprehensive insights", "high-level overview"
- Multi-chart requests: "create worksheet with depth and magnitude histograms"
- Dashboard requests: "add dashboard analyzing sales data" (use two-step workflow)

IMPORTANT: IF primary artefact in run context is a worksheet, prioritize using this tool for any queries or data analysis tasks.`,
    inputSchema: WorksheetAgentInputSchema,
    execute: async (params, toolOptions): Promise<WorksheetAgentResult> => {
      const {prompt, worksheetId, maxSteps, temperature} = params;

      try {
        worksheetAdapter.ensureWorksheet(worksheetId);
        worksheetAdapter.setCurrentWorksheet(worksheetId);

        const dataTools = options.createDataTools?.({store}) ?? {};

        const agent = new ToolLoopAgent({
          model: options.getModel({state: store.getState()}),
          tools: {
            ...dataTools,
            ...createWorksheetAiTools({
              databaseAdapter,
              worksheetAdapter,
              worksheetId,
              chartToolsOptions,
              dashboardAgentTool,
              extraTools,
            }),
          },
          temperature: Math.max(0, Math.min(1, temperature ?? 0.7)),
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions:
            options.instructions ?? getWorksheetAgentInstructions(options),
        });

        const result = await options.runSubAgent({
          agent,
          prompt,
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const metadata = calculateAgentResultMetadata(
          undefined,
          result.agentToolCalls,
        );

        return {
          success: true,
          finalOutput: result.finalOutput || 'Worksheet created successfully.',
          worksheetId,
          metadata,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        const friendlyMessage =
          error instanceof AiAgentError
            ? errorMessage
            : 'Worksheet agent execution failed.';

        return {
          success: false,
          finalOutput: friendlyMessage,
          worksheetId,
          error: errorMessage,
        };
      }
    },
  });
}
