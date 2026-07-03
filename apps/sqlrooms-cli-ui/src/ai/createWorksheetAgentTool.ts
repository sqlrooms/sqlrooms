import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import type {
  BaseAgentToolOptions,
  ChartToolsOptions,
} from '@sqlrooms/mosaic/ai';
import {
  AiAgentError,
  BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
  calculateAgentResultMetadata,
  createChartToolsInstructions,
  resolveChartTypes,
  type AgentRunResult,
  type AgentToolCall,
  type DatabaseAiAdapter,
} from '@sqlrooms/mosaic/ai';
import type {BlockDocumentAiAdapter} from '@sqlrooms/documents';
import type {RoomState} from '../store-types';
import {
  createWorksheetBlockDocumentAiTools,
  type ExtraWorksheetAiToolsFactory,
} from './createWorksheetBlockDocumentAiTools';
import {KnownWorksheetTools, WORKSHEET_AGENT_TOOL_NAME} from './constants';

const AgentIntentSchemaFields = {
  intent: z
    .string()
    .min(1, 'intent cannot be empty')
    .describe('The natural-language objective for the agent to satisfy.'),
};

export type WorksheetAgentResult = {
  success: boolean;
  finalOutput: string;
  worksheetId: string;
  error?: string;
  metadata?: ReturnType<typeof calculateAgentResultMetadata>;
};

export type CreateWorksheetAgentToolOptions =
  BaseAgentToolOptions<RoomState> & {
    blockDocumentAdapter: BlockDocumentAiAdapter;
    databaseAdapter: DatabaseAiAdapter;
    dashboardAgentTool: Tool;
    chartToolsOptions?: ChartToolsOptions;
    htmlAppBlocksEnabled?: boolean;
    mapBlocksEnabled?: boolean;
    extraTools?: ExtraWorksheetAiToolsFactory;
    createDashboardBlock: Parameters<
      typeof createWorksheetBlockDocumentAiTools
    >[0]['createDashboardBlock'];
    createDataTableExplorerBlock: Parameters<
      typeof createWorksheetBlockDocumentAiTools
    >[0]['createDataTableExplorerBlock'];
    createHtmlAppBlock?: Parameters<
      typeof createWorksheetBlockDocumentAiTools
    >[0]['createHtmlAppBlock'];
    addDashboardBlock?: Parameters<
      typeof createWorksheetBlockDocumentAiTools
    >[0]['addDashboardBlock'];
    addDataTableExplorerBlock?: Parameters<
      typeof createWorksheetBlockDocumentAiTools
    >[0]['addDataTableExplorerBlock'];
    addHtmlAppBlock?: Parameters<
      typeof createWorksheetBlockDocumentAiTools
    >[0]['addHtmlAppBlock'];
  };

function getWorksheetAgentInstructions(
  options: CreateWorksheetAgentToolOptions,
): string {
  const chartTools = resolveChartTypes(options.chartToolsOptions?.chartTypes);
  const htmlAppBlocksEnabled = options.htmlAppBlocksEnabled !== false;
  const mapBlocksEnabled = options.mapBlocksEnabled === true;

  const chartToolsInstructions = createChartToolsInstructions(
    chartTools,
    BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
  );

  return `You are a worksheet builder AI agent that creates interactive data worksheets.

## Your Role

In this CLI app, a worksheet is a block document artifact: an ordered block-based document whose blocks can contain charts, text, data table explorers, dashboards, maps, and embedded apps.

You create DATA VISUALIZATION WORKSHEETS by adding or updating BLOCK DOCUMENT BLOCKS: CHART BLOCKS, TEXT BLOCKS, DATA TABLE EXPLORER BLOCKS, DASHBOARD BLOCKS, MAP BLOCKS, and APP BLOCKS.
You can handle both direct requests ("create histogram of magnitude") and exploratory requests ("find interesting insights in earthquakes dataset").

CRITICAL RULES:
1. Your PRIMARY OUTPUT is CHART BLOCKS (visualizations) and TEXT BLOCKS for summaries and context.
2. A "comprehensive worksheet" means MULTIPLE CHARTS showing different aspects of the data
3. You MUST create at least 3-5 chart blocks for exploratory requests
4. Prefer CHARTS with TEXT BLOCKS for context. Text blocks alone are insufficient.
5. Use DASHBOARD BLOCKS when interactive exploration of multiple related dimensions would enhance the analysis.
6. Use DATA TABLE EXPLORER BLOCK when users need to explore raw data in a tabular format. Only add one block per worksheet, and only if the user explicitly requests it or if it is necessary for exploration.
7. ${
    mapBlocksEnabled
      ? 'If the user asks to add a map or geospatial visualization to a worksheet, use the available direct worksheet map block tool; do not create a dashboard block solely to hold a map.'
      : `If the user asks to add a map or geospatial visualization to a worksheet dashboard, use a dashboard block and ${KnownWorksheetTools.embedded_dashboard_agent}; worksheet chart tools cannot create map panels.`
  }
${htmlAppBlocksEnabled ? `8. If the user asks for an HTML app, D3 app, Chart.js app, browser app, custom interactive visualization, or generated app inside a worksheet, use ${KnownWorksheetTools.add_html_app_block} + ${KnownWorksheetTools.embedded_html_app_agent}. Do not create a top-level html-app artifact from inside ${WORKSHEET_AGENT_TOOL_NAME}.` : ''}

## Creating Blocks

### Existing Blocks
Before updating a worksheet dashboard${
    htmlAppBlocksEnabled ? ', updating an existing worksheet HTML app,' : ''
  } or adding a map to an existing worksheet, call ${KnownWorksheetTools.list_blocks} to find existing dashboard${
    htmlAppBlocksEnabled ? '/html-app' : ''
  } blocks and their resource IDs. For stateful blocks, use statefulBlock.blockType to identify the surface and statefulBlock.blockInstanceId as dashboardId, appId, or mapId for the matching embedded tool.

When the user asks to copy, duplicate, recreate, or use the same chart/content from another worksheet, treat both worksheets as block document artifacts:
- Call ${KnownWorksheetTools.list_blocks} with the source block document artifact ID to identify the source blockIds.
- Call ${KnownWorksheetTools.copy_blocks} with sourceBlockDocumentId, targetBlockDocumentId, and the selected blockIds.
- You may use the same sourceBlockDocumentId and targetBlockDocumentId to duplicate blocks inside the current worksheet.

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
- Provide intent when the request includes a durable purpose for the block
- Only add one data table explorer block per worksheet
- Only add if user explicitly requests it or if it is necessary for exploration

### Dashboard Blocks
To create an interactive dashboard block for data exploration, use a TWO-STEP workflow:

If the worksheet already has a dashboard block that matches the request, reuse it:
- Call ${KnownWorksheetTools.list_blocks}
- Use the dashboard block's statefulBlock.blockInstanceId as dashboardId when calling ${KnownWorksheetTools.embedded_dashboard_agent}

STEP 1: Create the empty dashboard block container
- Call ${KnownWorksheetTools.add_dashboard_block} with:
  - dashboardTitle: title for the dashboard
  - tableName: the dataset to analyze
  - intent: durable purpose for this dashboard block
- This returns a dashboardId

STEP 2: Populate the dashboard with charts and panels
- Call ${KnownWorksheetTools.embedded_dashboard_agent} with:
  - dashboardId: the ID from step 1
  - tableName: the dataset to analyze
  - intent: what insights or charts to create

Use dashboard blocks when:
- User explicitly requests a dashboard: "add dashboard analyzing sales data"
- User asks for a map, geospatial visualization, locations, longitude/latitude, geometry, H3, routes, or spatial analysis and no direct worksheet map block tool is available
- Interactive exploration would be valuable: multiple related dimensions benefit from coordinated views
- Dataset has multiple dimensions suitable for multi-faceted analysis
- The dashboard will contain 3-5 panels showing different aspects of the data

${
  htmlAppBlocksEnabled
    ? `
### HTML App Blocks
To create a custom embedded browser app inside the worksheet, use a TWO-STEP workflow:

If the worksheet already has an html-app block that matches the request, reuse it:
- Call ${KnownWorksheetTools.list_blocks}
- Use the html-app block's statefulBlock.blockInstanceId as appId when calling ${KnownWorksheetTools.embedded_html_app_agent}

STEP 1: Create the empty html-app block container
- Call ${KnownWorksheetTools.add_html_app_block} with:
  - appTitle: title for the app
  - intent: durable purpose for this app block
- This returns an appId

STEP 2: Write the app files and observe runtime diagnostics
- Call ${KnownWorksheetTools.embedded_html_app_agent} with:
  - appId: the ID from step 1
  - intent: what app or visualization to create

Use html-app blocks when:
- User explicitly asks for an app, HTML app, D3 app, Chart.js app, browser app, or custom interactive visualization
- The requested interaction is not well represented by built-in worksheet chart blocks or dashboard panels
- The app should call SQLRooms through window.sqlrooms.query(...) or window.sqlrooms.queryRows(...)

If updating an existing worksheet app, first call ${KnownWorksheetTools.list_blocks}, find an html-app block, and pass its statefulBlock.blockInstanceId as appId to ${KnownWorksheetTools.embedded_html_app_agent}.
For incremental edits to an existing worksheet app, such as changing title, labels, colors, styles, layout, controls, or interactions, do not inspect tables or schemas first unless the user explicitly asks to change the app's data/query behavior.
`
    : ''
}

## Workflows

### Direct Requests
When user asks for specific charts (e.g., "create histogram of depth and magnitude"):
1. DO NOT run exploratory queries - go straight to creating charts
2. Call ${BLOCK_DOCUMENT_CHART_TOOL_PREFIX}* for each chart mentioned
3. Add text blocks only for brief context or summaries, if needed
4. Done after ALL requested charts are created

**Exception:** If user explicitly requests a dashboard ("add dashboard for X dataset"), use the TWO-STEP workflow:
1. Call ${KnownWorksheetTools.add_dashboard_block} to create the container
2. Call ${KnownWorksheetTools.embedded_dashboard_agent} with the returned dashboardId to populate it

**Map requests:** ${
    mapBlocksEnabled
      ? `If user asks to add a map to a worksheet, use the direct worksheet map block tool. If updating an existing worksheet map, call ${KnownWorksheetTools.list_blocks} first and pass the map resource ID to the map tool.`
      : `If user asks to add a map to an existing worksheet/dashboard, call ${KnownWorksheetTools.list_blocks}. If a dashboard block exists, call ${KnownWorksheetTools.embedded_dashboard_agent} with that dashboardId and an intent to create or update a map panel. If no dashboard block exists, create one first with ${KnownWorksheetTools.add_dashboard_block}.`
  }

${htmlAppBlocksEnabled ? `**HTML app requests:** If user asks to create a new app inside the worksheet, call ${KnownWorksheetTools.add_html_app_block}, then call ${KnownWorksheetTools.embedded_html_app_agent} with the returned appId. If modifying an existing app, call ${KnownWorksheetTools.list_blocks} first and pass the target statefulBlock.blockInstanceId as appId.` : ''}

### Exploratory Requests
When user asks for "comprehensive analysis" or "high-level insights":
1. REQUIRED: Create at least 3-5 CHART BLOCKS minimum
2. Exploration strategy:
   a. Run 1-2 quick queries to understand the data (optional, can skip if columns are obvious)
   b. IMMEDIATELY start creating charts - do NOT spend too much time on queries
   c. Create diverse chart types: histograms, count plots, scatter plots, heatmaps, etc.
   d. Each chart should show a different aspect of the data
   e. Add brief text blocks for context or summaries
3. Call ${BLOCK_DOCUMENT_CHART_TOOL_PREFIX}* multiple times for different visualizations
4. AVOID: Long text narratives, extensive query exploration, creating text blocks instead of charts
5. SUCCESS CRITERIA: Worksheet contains 3+ interactive visualizations with summaries and context

**Consider dashboard blocks when:**
- Dataset has multiple dimensions that benefit from coordinated visualization (e.g., geography + product category + time)
- A map panel is requested and no direct worksheet map block tool is available
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

Common mistakes to avoid:
- Creating only text blocks describing what you would create
- Running 10+ queries without creating any charts
- Creating just 1-2 charts for "comprehensive analysis" requests
- Writing long narratives instead of showing data visually
- Missing opportunities for interactive exploration with dashboard blocks
- Creating a chat-only or markdown map when the user asked to add a map to a worksheet or dashboard
${htmlAppBlocksEnabled ? '- Creating a top-level html-app artifact when the user asked for an app in the current worksheet' : ''}

Success patterns:
- Create 3-5+ diverse chart blocks for exploratory requests
- Call ${BLOCK_DOCUMENT_CHART_TOOL_PREFIX}* tools to automatically create charts
- Mix different chart types to show different patterns
- Use ${KnownWorksheetTools.add_dashboard_block} + ${KnownWorksheetTools.embedded_dashboard_agent} (two-step) when user explicitly asks for dashboard or when coordinated multi-view analysis would enhance exploration
${
  mapBlocksEnabled
    ? `- For map requests, use the direct worksheet map block tool; call ${KnownWorksheetTools.list_blocks} first when updating an existing map and pass its statefulBlock.blockInstanceId as mapId`
    : `- For map requests, use ${KnownWorksheetTools.list_blocks} then ${KnownWorksheetTools.embedded_dashboard_agent} so the map is added as a dashboard panel`
}
${htmlAppBlocksEnabled ? `- For worksheet app requests, use ${KnownWorksheetTools.add_html_app_block} + ${KnownWorksheetTools.embedded_html_app_agent} so the app is embedded in the worksheet` : ''}
- Charts are created immediately when you call the ${BLOCK_DOCUMENT_CHART_TOOL_PREFIX}* tools`;
}

const WorksheetAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the worksheet agent is being called'),
  ...AgentIntentSchemaFields,
  worksheetId: z
    .string()
    .describe(
      'Target worksheet block-document artifact ID where blocks will be added.',
    ),
  sourceBlockDocumentId: z
    .string()
    .optional()
    .describe(
      'Optional source worksheet/block document artifact ID to inspect when copying, duplicating, or recreating existing blocks.',
    ),
  maxSteps: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum exploration steps (default: 20, range: 5-50)'),
});

type WorksheetAgentInputSchema = z.infer<typeof WorksheetAgentInputSchema>;

const WORKSHEET_MUTATION_TOOL_NAMES = new Set<string>([
  KnownWorksheetTools.add_text_block,
  KnownWorksheetTools.add_dashboard_block,
  KnownWorksheetTools.add_data_table_explorer,
  KnownWorksheetTools.add_html_app_block,
  KnownWorksheetTools.copy_blocks,
  KnownWorksheetTools.create_block_document_map_block,
  KnownWorksheetTools.embedded_dashboard_agent,
  KnownWorksheetTools.embedded_html_app_agent,
]);

function hasWorksheetMutationToolCall(toolCalls: AgentToolCall[] = []) {
  for (const toolCall of toolCalls) {
    if (
      toolCall.toolName.startsWith(BLOCK_DOCUMENT_CHART_TOOL_PREFIX) ||
      WORKSHEET_MUTATION_TOOL_NAMES.has(toolCall.toolName)
    ) {
      return true;
    }
  }
  return false;
}

function shouldRequireWorksheetMutation(intent: string) {
  const normalized = intent.toLowerCase();
  if (
    /^\s*(what|which|who|when|where|why|how|list|tell|describe|explain|inspect)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    /\b(add|append|build|copy|create|delete|duplicate|edit|embed|graph|insert|make|modify|move|plot|put|remove|replace|update|visuali[sz]e)\b/.test(
      normalized,
    ) ||
    /\b(chart|dashboard|data table explorer|html app|map|text block|worksheet block)\b/.test(
      normalized,
    )
  );
}

function shouldHintSourceBlockDocument(intent: string) {
  return /\b(copy|clone|duplicate|recreate|same)\b/.test(intent.toLowerCase());
}

function inferSourceBlockDocumentId(
  state: RoomState,
  targetWorksheetId: string,
) {
  const currentArtifactId = state.artifacts?.config.currentArtifactId;
  if (!currentArtifactId || currentArtifactId === targetWorksheetId) {
    return undefined;
  }

  const currentArtifact = state.artifacts?.getArtifact?.(currentArtifactId);
  return currentArtifact?.type === 'worksheet' ? currentArtifactId : undefined;
}

function createWorksheetSubAgentPrompt({
  intent,
  sourceBlockDocumentId,
  worksheetId,
}: {
  intent: string;
  sourceBlockDocumentId?: string;
  worksheetId: string;
}) {
  if (!sourceBlockDocumentId) return intent;

  return `${intent}

Target worksheet block document artifact ID: ${worksheetId}
Source worksheet block document artifact ID: ${sourceBlockDocumentId}

For copy, duplicate, recreate, or "same chart/content" requests, inspect the source with ${KnownWorksheetTools.list_blocks} and copy selected blocks into the target with ${KnownWorksheetTools.copy_blocks}.`;
}

/**
 * Creates the CLI worksheet block-document artifact agent tool.
 */
export function createWorksheetAgentTool(
  options: CreateWorksheetAgentToolOptions,
): Tool {
  const {
    store,
    blockDocumentAdapter,
    databaseAdapter,
    chartToolsOptions,
    dashboardAgentTool,
    extraTools,
    htmlAppBlocksEnabled = true,
    mapBlocksEnabled = false,
    createDashboardBlock,
    createDataTableExplorerBlock,
    createHtmlAppBlock,
    addDashboardBlock,
    addDataTableExplorerBlock,
    addHtmlAppBlock,
  } = options;

  return tool({
    description: `An AI agent that creates DATA ANALYSIS WORKSHEETS with:
- CHART BLOCKS (histograms, scatter plots, heatmaps, etc.)
- TEXT BLOCKS (headings, paragraphs, lists)
- DASHBOARD BLOCKS (interactive dashboards for multi-faceted exploration)
${htmlAppBlocksEnabled ? '- HTML APP BLOCKS (custom browser apps powered by window.sqlrooms.query/queryRows)' : ''}

IF user requests DASHBOARD:
1. Call ${KnownWorksheetTools.add_dashboard_block} to create the container (get dashboardId)
2. Call ${KnownWorksheetTools.embedded_dashboard_agent} with dashboardId to populate it with charts

IF user requests a MAP in a worksheet:
${
  mapBlocksEnabled
    ? `1. For a new map, call ${KnownWorksheetTools.create_block_document_map_block} directly
2. For an existing map, call ${KnownWorksheetTools.list_blocks} and pass statefulBlock.blockInstanceId as mapId to create_block_document_map_block`
    : `1. Call ${KnownWorksheetTools.list_blocks} to find an existing dashboard block
2. Reuse an existing dashboardId if available, otherwise call ${KnownWorksheetTools.add_dashboard_block}
3. Call ${KnownWorksheetTools.embedded_dashboard_agent} with an intent to add a map panel`
}

IF user requests copying, duplicating, or recreating the same worksheet chart/content:
1. Use ${KnownWorksheetTools.list_blocks} to inspect the source worksheet block document
2. Use ${KnownWorksheetTools.copy_blocks} to append the selected source blocks into the target worksheet block document

${
  htmlAppBlocksEnabled
    ? `
IF user requests an HTML/D3/Chart.js/browser app in a worksheet:
1. For a new app, call ${KnownWorksheetTools.add_html_app_block} to create the container, then call ${KnownWorksheetTools.embedded_html_app_agent} with the returned appId
2. For an existing app, call ${KnownWorksheetTools.list_blocks}, then call ${KnownWorksheetTools.embedded_html_app_agent} with statefulBlock.blockInstanceId as appId
`
    : ''
}

Otherwise, create chart and text blocks directly using ${BLOCK_DOCUMENT_CHART_TOOL_PREFIX}* tools.

Use this for:
- Exploratory requests: "analyze the earthquakes dataset", "create comprehensive insights", "high-level overview"
- Multi-chart requests: "create worksheet with depth and magnitude histograms"
- Dashboard requests: "add dashboard analyzing sales data" (use two-step workflow)
${htmlAppBlocksEnabled ? '- App requests in worksheets: "create an app", "make a D3 visualization", "build a browser widget"' : ''}

IMPORTANT: IF primary artefact in run context is a worksheet, prioritize using this tool for any queries or data analysis tasks.`,
    inputSchema: WorksheetAgentInputSchema,
    execute: async (params, toolOptions): Promise<WorksheetAgentResult> => {
      const {worksheetId, maxSteps} = params;
      const {intent} = params;

      try {
        const state = store.getState();
        const sourceBlockDocumentId =
          params.sourceBlockDocumentId ??
          (shouldHintSourceBlockDocument(intent)
            ? inferSourceBlockDocumentId(state, worksheetId)
            : undefined);
        const worksheetSubAgentPrompt = createWorksheetSubAgentPrompt({
          intent,
          sourceBlockDocumentId,
          worksheetId,
        });

        blockDocumentAdapter.ensureBlockDocument(worksheetId);
        const initialBlockCount =
          blockDocumentAdapter.getBlocks(worksheetId)?.length ?? 0;

        const dataTools = options.createDataTools?.({store}) ?? {};

        const agent = new ToolLoopAgent({
          model: options.getModel({state}),
          tools: {
            ...createWorksheetBlockDocumentAiTools({
              databaseAdapter,
              blockDocumentAdapter,
              worksheetId,
              chartToolsOptions,
              dashboardAgentTool,
              extraTools,
              htmlAppBlocksEnabled,
              createDashboardBlock,
              createDataTableExplorerBlock,
              createHtmlAppBlock,
              addDashboardBlock,
              addDataTableExplorerBlock,
              addHtmlAppBlock,
            }),
            ...dataTools,
          },
          stopWhen: [stepCountIs(Math.max(5, Math.min(50, maxSteps ?? 20)))],
          instructions: [
            options.instructions ?? getWorksheetAgentInstructions(options),
            options.additionalInstructions,
          ]
            .filter(Boolean)
            .join('\n\n'),
        });

        const runWorksheetSubAgent = (prompt: string) =>
          options.runSubAgent({
            agent,
            prompt,
            store,
            parentToolCallId: toolOptions?.toolCallId || '',
            abortSignal: toolOptions?.abortSignal,
          });

        let result: AgentRunResult = await runWorksheetSubAgent(
          worksheetSubAgentPrompt,
        );
        const allToolCalls = [...(result.agentToolCalls ?? [])];
        const requiresWorksheetMutation =
          shouldRequireWorksheetMutation(intent);
        let currentBlockCount =
          blockDocumentAdapter.getBlocks(worksheetId)?.length ?? 0;

        if (
          requiresWorksheetMutation &&
          currentBlockCount === initialBlockCount &&
          !hasWorksheetMutationToolCall(allToolCalls)
        ) {
          result = await runWorksheetSubAgent(`${worksheetSubAgentPrompt}

The previous attempt did not modify the worksheet block document. You must call one of the block document mutation tools, such as a ${BLOCK_DOCUMENT_CHART_TOOL_PREFIX}* chart tool, ${KnownWorksheetTools.add_text_block}, ${KnownWorksheetTools.copy_blocks}, ${KnownWorksheetTools.add_dashboard_block}, or another add/update block tool. Do not answer with only text.`);
          allToolCalls.push(...(result.agentToolCalls ?? []));
          currentBlockCount =
            blockDocumentAdapter.getBlocks(worksheetId)?.length ?? 0;
        }

        if (
          requiresWorksheetMutation &&
          currentBlockCount === initialBlockCount &&
          !hasWorksheetMutationToolCall(allToolCalls)
        ) {
          return {
            success: false,
            finalOutput:
              'Worksheet agent did not modify the worksheet block document. Please retry and call a block mutation tool.',
            worksheetId,
            error:
              'Worksheet agent completed without a block document mutation.',
          };
        }

        const metadata = calculateAgentResultMetadata(undefined, allToolCalls);

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
