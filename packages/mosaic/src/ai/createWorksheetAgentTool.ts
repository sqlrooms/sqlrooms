import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import type {DataTable} from '@sqlrooms/db';
import {createChartTools} from '../charts/chart-types/createChartTools';
import {createDefaultChartTypes} from '../charts/chart-types/createDefaultChartTypes';
import {createChartToolDeps} from './createChartToolDeps';
import {createAddTextBlockTool} from './createAddTextBlockTool';
import type {
  WorksheetAiAdapter,
  CreateWorksheetAgentToolOptions,
  WorksheetAgentResult,
  AgentToolCall,
} from './types';
import {createDefaultBlockDocumentBlockId} from '@sqlrooms/documents';

const WORKSHEET_AGENT_INSTRUCTIONS = `You are a worksheet builder agent that creates and modifies interactive data worksheets.

## Your Role

You create DATA VISUALIZATION WORKSHEETS with CHART BLOCKS and TEXT BLOCKS. 
You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

CRITICAL RULES:
1. Your PRIMARY OUTPUT is CHART BLOCKS (visualizations) and TEXT BLOCKS for summaries and context.
2. A "comprehensive worksheet" means MULTIPLE CHARTS showing different aspects of the data
3. You MUST create at least 3-5 chart blocks for exploratory requests
4. Prefer CHARTS with TEXT BLOCKS for context. Text blocks alone are insufficient.

## Creating Blocks

### Chart Blocks
To create a chart block in a worksheet, call one of the chart generation tools:
- generate_chart_histogram - distribution of numeric values (always safe, aggregates automatically)
- generate_chart_line_chart - trends over time or ordered variable (use with aggregations for >10k rows)
- generate_chart_box_plot - compare distributions across categories
- generate_chart_scatter_plot - relationship between two numeric columns (avoid for >10k rows, use heatmap instead)
- generate_chart_count_plot - frequency of categorical values (always safe, aggregates automatically)
- generate_chart_heatmap - density/patterns across two dimensions (preferred for large datasets)

### Text Blocks
To add text context or summaries, use the add_text_block tool:
- Type "heading" (level 1-3) - for section titles
- Type "paragraph" - for explanatory text
- Type "list" (ordered/unordered) - for key points or findings

## Workflows

### Direct Requests
When user asks for specific charts (e.g., "create histogram of depth and magnitude"):
1. DO NOT run exploratory queries - go straight to creating charts
2. Call generate_chart_* for each chart mentioned
3. Add text blocks only for brief context or summaries, if needed
4. Done after ALL requested charts are created

### Exploratory Requests
When user asks for "comprehensive analysis" or "high-level insights":
1. REQUIRED: Create at least 3-5 CHART BLOCKS minimum
2. Exploration strategy:
   a. Run 1-2 quick queries to understand the data (optional, can skip if columns are obvious)
   b. IMMEDIATELY start creating charts - do NOT spend too much time on queries
   c. Create diverse chart types: histograms, count plots, scatter plots, heatmaps, etc.
   d. Each chart should show a different aspect of the data
   e. Add brief text blocks for context or summaries
3. Call generate_chart_* multiple times for different visualizations
4. AVOID: Long text narratives, extensive query exploration, creating text blocks instead of charts
5. SUCCESS CRITERIA: Worksheet contains 3+ interactive visualizations with summaries and context

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

✅ Create 3-5+ diverse chart blocks for exploratory requests
✅ Call generate_chart_* tools to automatically create charts
✅ Mix different chart types to show different patterns
✅ Charts are created immediately when you call the generate_chart_* tools`;

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
  tableName: z
    .string()
    .optional()
    .describe(
      'Optional primary table name. If specified, provides context about this table. Charts can use any available table.',
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

class WorksheetAgentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorksheetAgentException';
  }
}

function formatAvailableTables(tables: DataTable[]): string {
  return tables.map((table) => table.table.toString()).join(', ') || '(none)';
}

function buildToolsList(
  chartTools: Record<string, Tool>,
  queryTools?: {query: Tool},
): string {
  const sections: string[] = [];

  // Chart generation tools
  const chartToolNames = Object.keys(chartTools).sort();
  if (chartToolNames.length > 0) {
    sections.push(
      `**Chart Tools:**
Add chart blocks to the worksheet using the following tools: 
${chartToolNames.map((name) => `- ${name}`).join('\n')}`,
    );
  }

  // Text block tool
  sections.push(
    '**Text Block Tool:**\n' + '- add_text_block - add text blocks',
  );

  // Query tools
  if (queryTools) {
    sections.push(
      '**Data Tools:**\n- query - execute SQL queries for data exploration',
    );
  }

  return sections.join('\n\n');
}

function buildAgentPrompt(
  userPrompt: string,
  tableName: string | undefined,
  adapter: WorksheetAiAdapter,
  worksheetId: string,
  availableTools: string,
): string {
  const tables = adapter.getTables();

  if (tableName) {
    const table = tables.find((candidate) => candidate.tableName === tableName);
    const columnNames =
      table?.columns?.map((column) => column.name).join(', ') || 'unknown';
    const rowInfo =
      table?.rowCount !== undefined
        ? `Approximate rows: ${table.rowCount}`
        : '';

    return `Analyze the "${tableName}" table and create chart blocks in the worksheet.

Worksheet ID: ${worksheetId}

Table info:
- Columns: ${columnNames}${rowInfo ? `\n- ${rowInfo}` : ''}

Available tools:
${availableTools}

User request: ${userPrompt}

Focus on discovering meaningful patterns and creating visualizations that tell a clear story.`;
  }

  // No specific table - provide list of available tables
  const tablesList = tables
    .map(
      (t) =>
        `- ${t.tableName} (${t.columns?.length || 0} columns${t.rowCount ? `, ~${t.rowCount} rows` : ''})`,
    )
    .join('\n');

  return `Create a worksheet based on the following request.

Worksheet ID: ${worksheetId}

Available tables:
${tablesList || '(no tables available)'}

Available tools:
${availableTools}

User request: ${userPrompt}

You can use any of the available tables. Focus on discovering meaningful patterns and creating visualizations that tell a clear story.`;
}

function validateTableExists(
  adapter: WorksheetAiAdapter,
  tableName: string | undefined,
): void {
  if (!tableName) return; // No table specified - agent will discover tables

  const tables = adapter.getTables();
  const table = tables.find((candidate) => candidate.tableName === tableName);
  if (!table) {
    throw new WorksheetAgentException(
      `Table "${tableName}" not found. Available tables: ${formatAvailableTables(tables)}`,
    );
  }
}

function calculateAgentMetadata(
  adapter: WorksheetAiAdapter,
  worksheetId: string,
  tableName: string | undefined,
  agentToolCalls: AgentToolCall[],
): WorksheetAgentResult['metadata'] {
  const blocks = adapter.getWorksheetBlocks(worksheetId);
  return {
    tableName: tableName || undefined,
    blocksCreated: blocks?.length || 0,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}

function createWorksheetChartTools<TState>(
  options: CreateWorksheetAgentToolOptions<TState>,
  worksheetId: string,
): Record<string, Tool> {
  const resolvedChartTypes =
    options.chartTypes ?? createDefaultChartTypes({includeCustomSpec: false});

  // Create a wrapper adapter that matches BaseAiAdapter signature
  const baseAdapter = {
    getTables: () => options.adapter.getTables(),
    setCurrentArtifact: (artifactId: string) =>
      options.adapter.setCurrentArtifact(artifactId),
  };

  const chartToolDeps = createChartToolDeps({
    adapter: baseAdapter,
    addChart: ({config, tableName}) => {
      return options.adapter.addBlock(worksheetId, {
        type: 'chart',
        id: createDefaultBlockDocumentBlockId(),
        config,
        tableName,
      });
    },
  });

  return createChartTools(
    resolvedChartTypes,
    chartToolDeps,
    'generate_chart_', // Worksheet-specific prefix
  );
}

export function createWorksheetAgentTool<TState>(
  options: CreateWorksheetAgentToolOptions<TState>,
): Tool {
  const {store, adapter} = options;

  return tool({
    description: `An AI agent that creates DATA VISUALIZATION WORKSHEETS with 3-5+ interactive chart blocks.

Use this for:
- Exploratory requests: "analyze the earthquakes dataset", "create comprehensive insights", "high-level overview"
- Multi-chart requests: "create worksheet with depth and magnitude histograms"

Output: A worksheet with multiple interactive charts (histograms, scatter plots, heatmaps, etc.)

OPTIONAL:
- tableName: provide if user mentions a specific primary dataset for context`,
    inputSchema: WorksheetAgentInputSchema,
    execute: async (params, toolOptions): Promise<WorksheetAgentResult> => {
      const {prompt, worksheetId, tableName, maxSteps, temperature} = params;

      try {
        validateTableExists(adapter, tableName);

        adapter.ensureWorksheet(worksheetId);
        adapter.setCurrentArtifact(worksheetId);

        const queryTools = options.createQueryTools?.({store});

        const chartTools = createWorksheetChartTools(options, worksheetId);

        // Create text block tool
        const addTextBlockTool = createAddTextBlockTool({
          adapter,
          worksheetId,
        });

        // Build dynamic tools list for the prompt
        const toolsList = buildToolsList(chartTools, queryTools);

        const worksheetAgent = new ToolLoopAgent({
          model: options.getModel({state: store.getState()}),
          tools: {
            ...(queryTools ? {query: queryTools.query} : {}),
            ...chartTools,
            add_text_block: addTextBlockTool,
          },
          temperature: Math.max(0, Math.min(1, temperature ?? 0.7)),
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions: options.instructions ?? WORKSHEET_AGENT_INSTRUCTIONS,
        });

        const result = await options.runSubAgent({
          agent: worksheetAgent,
          prompt: buildAgentPrompt(
            prompt,
            tableName,
            adapter,
            worksheetId,
            toolsList,
          ),
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const metadata = calculateAgentMetadata(
          adapter,
          worksheetId,
          tableName,
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
          error instanceof WorksheetAgentException
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
