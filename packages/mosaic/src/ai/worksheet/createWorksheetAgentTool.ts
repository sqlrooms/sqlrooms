import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {createAddTextBlockTool} from './createAddTextBlockTool';
import {createWorksheetChartTools} from './createWorksheetChartTools';
import type {AgentToolCall} from '../types';
import type {
  WorksheetAiAdapter,
  CreateWorksheetAgentToolOptions,
  WorksheetAgentResult,
} from './worksheet-types';
import {AiAgentError} from '../errors';
import {createWorksheetDashboardBlockAgentTool} from './createWorksheetDashboardBlockAgentTool';
import {MosaicDashboardStoreState} from '../../dashboard/MosaicDashboardSlice';

export const WORKSHEET_AGENT_GLOBAL_INSTRUCTIONS = `
IF primary artefact in run context is a worksheet, prioritize using worksheet_agent tool for any queries or data analysis tasks.`;

const WORKSHEET_AGENT_INSTRUCTIONS = `You are a worksheet builder agent that creates and modifies interactive data worksheets.

## Your Role

You create DATA VISUALIZATION WORKSHEETS with CHART BLOCKS, TEXT BLOCKS, and DASHBOARD BLOCKS.
You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

CRITICAL RULES:
1. Your PRIMARY OUTPUT is CHART BLOCKS (visualizations) and TEXT BLOCKS for summaries and context.
2. A "comprehensive worksheet" means MULTIPLE CHARTS showing different aspects of the data
3. You MUST create at least 3-5 chart blocks for exploratory requests
4. Prefer CHARTS with TEXT BLOCKS for context. Text blocks alone are insufficient.
5. Use DASHBOARD BLOCKS when cross-filtering or interactive exploration would enhance the analysis.

## Creating Blocks

### Chart Blocks
To create a chart block in a worksheet, call one of the chart generation tools:
- create_worksheet_block_histogram - distribution of numeric values (always safe, aggregates automatically)
- create_worksheet_block_line_chart - trends over time or ordered variable (use with aggregations for >10k rows)
- create_worksheet_block_box_plot - compare distributions across categories
- create_worksheet_block_scatter_plot - relationship between two numeric columns (avoid for >10k rows, use heatmap instead)
- create_worksheet_block_count_plot - frequency of categorical values (always safe, aggregates automatically)
- create_worksheet_block_heatmap - density/patterns across two dimensions (preferred for large datasets)

### Text Blocks
To add text context or summaries, use the add_text_block tool:
- Type "heading" (level 1-3) - for section titles
- Type "paragraph" - for explanatory text
- Type "list" (ordered/unordered) - for key points or findings

### Dashboard Blocks
To create an interactive dashboard block with cross-filtering capabilities, use the dashboard_agent tool:
- Creates a stateful dashboard block embedded in the worksheet
- Contains multiple panels (charts, Data Table Explorers) with cross-filtering
- Use when:
  - User explicitly requests a dashboard: "add dashboard analyzing sales data"
  - Interactive exploration would be valuable: multiple related dimensions that benefit from cross-filtering
  - Dataset has categorical dimensions suitable for drill-down analysis
- REQUIRED: Provide tableName parameter for the dataset to analyze
- The dashboard block will contain 3-5 panels showing different aspects of the data

## Workflows

### Direct Requests
When user asks for specific charts (e.g., "create histogram of depth and magnitude"):
1. DO NOT run exploratory queries - go straight to creating charts
2. Call create_worksheet_block_* for each chart mentioned
3. Add text blocks only for brief context or summaries, if needed
4. Done after ALL requested charts are created

**Exception:** If user explicitly requests a dashboard ("add dashboard for X dataset"), use dashboard_agent instead.

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
- Dataset has multiple categorical dimensions that would benefit from cross-filtering (e.g., geography + product category + time)
- User wants to "explore" or "drill down" into the data interactively
- Analysis would benefit from linked brushing across multiple visualizations

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
- **Dashboard blocks for interactive exploration:** When the dataset has multiple related dimensions (e.g., region, category, time period), consider using dashboard_agent to create an interactive dashboard block with cross-filtering capabilities
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
✅ Use dashboard_agent when user explicitly asks for dashboard or when cross-filtering would enhance analysis
✅ Charts are created immediately when you call the create_worksheet_block_* tools`;

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

function calculateAgentMetadata(
  adapter: WorksheetAiAdapter,
  worksheetId: string,
  agentToolCalls: AgentToolCall[],
): WorksheetAgentResult['metadata'] {
  const blocks = adapter.getWorksheetBlocks(worksheetId);
  return {
    blocksCreated: blocks?.length || 0,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}

export function createWorksheetAgentTool<
  TState extends MosaicDashboardStoreState,
>(options: CreateWorksheetAgentToolOptions<TState>): Tool {
  const {store, adapter} = options;

  return tool({
    description: `An AI agent that creates DATA ANALYSIS WORKSHEETS with:
- CHART BLOCKS (histograms, scatter plots, heatmaps, etc.)
- TEXT BLOCKS (headings, paragraphs, lists)
- DASHBOARD BLOCKS (interactive dashboards with cross-filtering) 

IF user requests DASHBOARD, use the dashboard_agent tool. Otherwise, create chart and text blocks directly.

Use this for:
- Exploratory requests: "analyze the earthquakes dataset", "create comprehensive insights", "high-level overview"
- Multi-chart requests: "create worksheet with depth and magnitude histograms"

OPTIONAL:
- tableName: provide if user mentions a specific primary dataset for context`,
    inputSchema: WorksheetAgentInputSchema,
    execute: async (params, toolOptions): Promise<WorksheetAgentResult> => {
      const {prompt, worksheetId, maxSteps, temperature} = params;

      try {
        adapter.ensureWorksheet(worksheetId);
        adapter.setCurrentArtifact(worksheetId);

        const queryTools = options.createQueryTools?.({store});

        const chartTools = createWorksheetChartTools(options, worksheetId);

        // Create text block tool
        const addTextBlockTool = createAddTextBlockTool({
          adapter,
          worksheetId,
        });

        const dashboardAgent = createWorksheetDashboardBlockAgentTool<TState>({
          ...options,
          worksheetId,
        });

        const worksheetAgent = new ToolLoopAgent({
          model: options.getModel({state: store.getState()}),
          tools: {
            ...(queryTools ? {query: queryTools.query} : {}),
            ...chartTools,
            add_text_block: addTextBlockTool,
            dashboard_agent: dashboardAgent,
          },
          temperature: Math.max(0, Math.min(1, temperature ?? 0.7)),
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions: options.instructions ?? WORKSHEET_AGENT_INSTRUCTIONS,
        });

        const result = await options.runSubAgent({
          agent: worksheetAgent,
          prompt,
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const metadata = calculateAgentMetadata(
          adapter,
          worksheetId,
          result.agentToolCalls || [],
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
