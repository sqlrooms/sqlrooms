import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import type {DataTable} from '@sqlrooms/db';
import {createChartTools} from '../charts/chart-types/createChartTools';
import {createDefaultChartTypes} from '../charts/chart-types/createDefaultChartTypes';
import {createChartToolDeps} from './createChartToolDeps';
import type {
  WorksheetAiAdapter,
  CreateWorksheetAgentToolOptions,
  WorksheetAgentResult,
  AgentToolCall,
} from './types';

const WORKSHEET_AGENT_INSTRUCTIONS = `You are a worksheet builder agent that creates and modifies interactive data worksheets.

## Your Role

You create DATA VISUALIZATION WORKSHEETS with CHART BLOCKS. You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

CRITICAL RULES:
1. Your PRIMARY OUTPUT is CHART BLOCKS (visualizations), NOT text blocks
2. A "comprehensive worksheet" means MULTIPLE CHARTS showing different aspects of the data
3. You MUST create at least 3-5 chart blocks for exploratory requests
4. Charts are MANDATORY - text/narrative blocks are optional and should be minimal
5. If you only create text blocks without charts, you have FAILED the task
6. DO NOT create richText blocks (type: 'richText', markdown: '...') - use simple heading or paragraph blocks instead
7. ONLY create chart blocks with worksheet_create-chart-block

## Two-Step Workflow for Creating Charts (MANDATORY)

To create a chart block in a worksheet, follow this two-step process:

**Step 1: Generate Chart Configuration**
Call one of the chart configuration tools:
- generate_chart_histogram - distribution of numeric values (always safe, aggregates automatically)
- generate_chart_line_chart - trends over time or ordered variable (use with aggregations for >10k rows)
- generate_chart_box_plot - compare distributions across categories
- generate_chart_scatter_plot - relationship between two numeric columns (avoid for >10k rows, use heatmap instead)
- generate_chart_count_plot - frequency of categorical values (always safe, aggregates automatically)
- generate_chart_heatmap - density/patterns across two dimensions (preferred for large datasets)

These tools validate settings and return chart configuration in the \`data\` field.

**Step 2: Create Chart Block**
Use worksheet_create-chart-block to create the block with the returned configuration:
\`\`\`
worksheet_create-chart-block(
  artifactId: <worksheetId>,
  tableName: <tableName>,
  config: <chartConfig from step 1 data field>,
  caption: <optional caption>
)
\`\`\`

CRITICAL: Call worksheet_create-chart-block IMMEDIATELY after each generate_chart_* call.
DO NOT batch multiple charts into one worksheet_append-blocks call - this will fail.
Each chart requires its own separate worksheet_create-chart-block call.

**Example Workflow (Single Chart):**
\`\`\`
Step 1: generate_chart_histogram(tableName: "earthquakes", settings: {field: "magnitude", maxBins: 20})
Returns: {success: true, data: {chartType: "histogram", settings: {...}}}

Step 2: worksheet_create-chart-block(artifactId: "worksheet-abc", tableName: "earthquakes", config: {...})
Chart block created! ✓
\`\`\`

**Example Workflow (Multiple Charts - CORRECT):**
\`\`\`
1. generate_chart_histogram(field: "magnitude")
2. worksheet_create-chart-block(config from step 1) ← Create immediately!
3. generate_chart_histogram(field: "depth")
4. worksheet_create-chart-block(config from step 3) ← Create immediately!
5. generate_chart_scatter_plot(x: "depth", y: "magnitude")
6. worksheet_create-chart-block(config from step 5) ← Create immediately!

Result: 3 chart blocks in worksheet ✓
\`\`\`

**WRONG Workflow (DO NOT DO THIS):**
\`\`\`
1. generate_chart_histogram(field: "magnitude")
2. generate_chart_histogram(field: "depth")
3. generate_chart_scatter_plot(x: "depth", y: "magnitude")
4. worksheet_append-blocks([all configs]) ← FAILS! Charts not created ✗
\`\`\`

IMPORTANT NOTES:
- Use the ENTIRE \`data\` object from step 1 as the \`config\` in step 2
- The worksheet ID (artifactId) is provided in your prompt context
- Do NOT manually construct the config - always use the output from generate_chart_* tools
- Available tools are listed in your prompt - check there for exact tool names
\`\`\`

## Workflows

### Direct Requests
When user asks for specific charts (e.g., "create histogram of depth and magnitude"):
1. DO NOT run exploratory queries - go straight to creating charts
2. For EACH chart mentioned (repeat this loop):
   a. Call generate_chart_* tool to get config
   b. IMMEDIATELY call worksheet_create-chart-block to create the block
   c. Move to next chart
3. Done only after ALL requested charts are created

PATTERN: generate → create → generate → create → generate → create (NOT: generate → generate → generate → create-all-at-once)

### Exploratory Requests
When user asks for "comprehensive analysis" or "high-level insights":
1. REQUIRED: Create at least 3-5 CHART BLOCKS minimum
2. Exploration strategy:
   a. Run 1-2 quick queries to understand the data (optional, can skip if columns are obvious)
   b. IMMEDIATELY start creating charts - do NOT spend too much time on queries
   c. Create diverse chart types: histograms, count plots, scatter plots, heatmaps, etc.
   d. Each chart should show a different aspect of the data
3. For each insight/pattern you want to show (REPEAT THIS LOOP):
   - Call generate_chart_* tool to get config
   - IMMEDIATELY call worksheet_create-chart-block with that config
   - Move on to next chart (do NOT batch multiple charts)
4. AVOID: Long text narratives, extensive query exploration, creating text blocks instead of charts
5. AVOID: Calling worksheet_append-blocks with multiple chart configs - this does NOT work
6. SUCCESS CRITERIA: Worksheet contains 3+ interactive visualizations

CORRECT PATTERN:
- generate_chart_histogram → worksheet_create-chart-block
- generate_chart_scatter_plot → worksheet_create-chart-block
- generate_chart_heatmap → worksheet_create-chart-block

WRONG PATTERN:
- generate_chart_histogram → generate_chart_scatter_plot → generate_chart_heatmap → worksheet_append-blocks (FAILS!)

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
❌ Calling generate_chart_* multiple times then worksheet_append-blocks once (THIS FAILS!)
❌ Using worksheet_append-blocks for charts - it's for text/markdown blocks only
❌ Creating richText blocks (type: 'richText', markdown: '...') - DON'T USE THESE!

✅ Create 3-5+ diverse chart blocks for exploratory requests
✅ Pattern: generate_chart_* → worksheet_create-chart-block → repeat
✅ Each chart needs its own worksheet_create-chart-block call
✅ Mix different chart types to show different patterns
✅ If text blocks are needed, use simple types: heading or paragraph (NOT richText)`;

const WorksheetAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the worksheet agent is being called'),
  prompt: z
    .string()
    .describe('The exploratory data analysis prompt for the agent'),
  worksheetId: z
    .string()
    .optional()
    .describe(
      'Target worksheet ID. If provided, charts will be added to this worksheet. If omitted and createNew is false, uses the currently selected worksheet. If omitted and createNew is true, creates a new worksheet.',
    ),
  tableName: z
    .string()
    .optional()
    .describe(
      'Optional primary table name. If specified, provides context about this table. Charts can use any available table.',
    ),
  worksheetTitle: z
    .string()
    .optional()
    .describe(
      'Optional title for the worksheet artifact (only used when creating a new worksheet)',
    ),
  createNew: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, always create a new worksheet (ignoring worksheetId). If false and worksheetId is provided, use that worksheet. If false and worksheetId is omitted, use the currently selected worksheet.',
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
  return tables.map((table) => table.tableName).join(', ') || '(none)';
}

function buildToolsList(
  chartTools: Record<string, Tool>,
  commandTools: Record<string, Tool>,
  queryTools?: {query: Tool},
): string {
  const sections: string[] = [];

  // Chart generation tools
  const chartToolNames = Object.keys(chartTools).sort();
  if (chartToolNames.length > 0) {
    sections.push(
      '**Chart Configuration Tools (Step 1):**\n' +
        chartToolNames.map((name) => `- ${name}`).join('\n'),
    );
  }

  // Block creation tools
  const commandToolNames = Object.keys(commandTools).sort();
  if (commandToolNames.length > 0) {
    sections.push(
      '**Block Creation Tools (Step 2):**\n' +
        commandToolNames.map((name) => `- ${name}`).join('\n'),
    );
  }

  // Query tools
  if (queryTools) {
    sections.push(
      '**Data Tools:**\n- query - execute SQL queries for data exploration',
    );
  }

  return sections.join('\n\n');
}

function buildAgentPrompt<TState>(
  userPrompt: string,
  tableName: string | undefined,
  state: TState,
  adapter: WorksheetAiAdapter<TState>,
  worksheetId: string,
  availableTools: string,
): string {
  const tables = adapter.getTables(state);

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

function validateTableExists<TState>(
  state: TState,
  adapter: WorksheetAiAdapter<TState>,
  tableName: string | undefined,
): void {
  if (!tableName) return; // No table specified - agent will discover tables

  const tables = adapter.getTables(state);
  const table = tables.find((candidate) => candidate.tableName === tableName);
  if (!table) {
    throw new WorksheetAgentException(
      `Table "${tableName}" not found. Available tables: ${formatAvailableTables(tables)}`,
    );
  }
}

function getOrCreateWorksheet<TState>(
  state: TState,
  adapter: WorksheetAiAdapter<TState>,
  worksheetId: string | undefined,
  tableName: string | undefined,
  worksheetTitle: string | undefined,
  createNew: boolean,
): string {
  // Priority 1: Force create new
  if (createNew) {
    const suggestedTitle =
      worksheetTitle ||
      (tableName
        ? `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Worksheet`
        : 'Worksheet');
    const newWorksheetId = adapter.createWorksheet(state, suggestedTitle);
    adapter.setCurrentArtifact(state, newWorksheetId);
    return newWorksheetId;
  }

  // Priority 2: Use explicitly provided worksheetId
  if (worksheetId) {
    adapter.ensureWorksheet(state, worksheetId);
    adapter.setCurrentArtifact(state, worksheetId);
    return worksheetId;
  }

  // Priority 3: Use currently selected worksheet
  const currentWorksheetId = adapter.getCurrentWorksheetId(state);
  if (currentWorksheetId) {
    adapter.ensureWorksheet(state, currentWorksheetId);
    return currentWorksheetId;
  }

  // Priority 4: No worksheet available, create a new one
  const suggestedTitle =
    worksheetTitle ||
    (tableName
      ? `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Worksheet`
      : 'Worksheet');
  const newWorksheetId = adapter.createWorksheet(state, suggestedTitle);
  adapter.setCurrentArtifact(state, newWorksheetId);
  return newWorksheetId;
}

function calculateAgentMetadata<TState>(
  state: TState,
  adapter: WorksheetAiAdapter<TState>,
  worksheetId: string,
  tableName: string | undefined,
  agentToolCalls: AgentToolCall[],
): WorksheetAgentResult['metadata'] {
  const blocks = adapter.getWorksheetBlocks(state, worksheetId);
  return {
    tableName: tableName || undefined,
    blocksCreated: blocks?.length || 0,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}

export function createWorksheetAgentTool<TState>(
  options: CreateWorksheetAgentToolOptions<TState>,
): Tool {
  const {store, adapter} = options;

  const chartToolDeps = createChartToolDeps(options);

  return tool({
    description: `An AI agent that creates DATA VISUALIZATION WORKSHEETS with 3-5+ interactive chart blocks.

Use this for:
- Exploratory requests: "analyze the earthquakes dataset", "create comprehensive insights", "high-level overview"
- Multi-chart requests: "create worksheet with depth and magnitude histograms"

The agent will create CHART BLOCKS (visualizations), not just text descriptions.

Output: A worksheet with multiple interactive charts (histograms, scatter plots, heatmaps, etc.)

For simple single-chart tasks, use individual chart tools instead.

## Worksheet Selection (choose ONE approach):

**Option 1: Use specific worksheet** - Provide worksheetId parameter
- Use when user references a specific worksheet (e.g., "add charts to worksheet X")
- Use when worksheet is in conversation context

**Option 2: Create new worksheet** - Set createNew=true
- Use when user explicitly asks to "create a new worksheet"
- Optionally provide worksheetTitle for the new worksheet

**Option 3: Use current worksheet** - Omit both worksheetId and createNew
- Default behavior when user doesn't specify
- Uses the currently selected/open worksheet

OPTIONAL:
- tableName: provide if user mentions a specific primary dataset for context`,
    inputSchema: WorksheetAgentInputSchema,
    execute: async (params, toolOptions): Promise<WorksheetAgentResult> => {
      const {
        prompt,
        worksheetId: inputWorksheetId,
        tableName,
        worksheetTitle,
        createNew,
        maxSteps,
        temperature,
      } = params;

      let worksheetId = '';

      try {
        const state = store.getState();

        validateTableExists(state, adapter, tableName);

        worksheetId = getOrCreateWorksheet(
          state,
          adapter,
          inputWorksheetId,
          tableName,
          worksheetTitle,
          createNew ?? false,
        );
        const queryTools = options.createQueryTools?.({store});

        const resolvedChartTypes =
          options.chartTypes ??
          createDefaultChartTypes({includeCustomSpec: false});

        // Chart tools only need ChartToolDeps: findTableByName + maxDataPoints
        const chartTools = createChartTools(
          resolvedChartTypes,
          chartToolDeps,
          'generate_chart_', // Worksheet-specific prefix
        );

        const commandTools = options.commandTools ?? {};

        // DEBUG: Log available tools
        console.log('[WORKSHEET AGENT] Chart tools:', Object.keys(chartTools));
        console.log(
          '[WORKSHEET AGENT] Command tools:',
          Object.keys(commandTools),
        );

        // Build dynamic tools list for the prompt
        const toolsList = buildToolsList(chartTools, commandTools, queryTools);

        const worksheetAgent = new ToolLoopAgent({
          model: options.getModel({state}),
          tools: {
            ...(queryTools ? {query: queryTools.query} : {}),
            ...chartTools,
            ...commandTools,
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
            state,
            adapter,
            worksheetId,
            toolsList,
          ),
          store,
          parentToolCallId: toolOptions?.toolCallId || '',
          abortSignal: toolOptions?.abortSignal,
        });

        const finalState = store.getState();
        const metadata = calculateAgentMetadata(
          finalState,
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
