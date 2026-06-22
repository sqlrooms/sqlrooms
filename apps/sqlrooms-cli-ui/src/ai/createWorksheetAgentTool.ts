import {type Tool, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import type {BlockDocumentAiAdapter} from '@sqlrooms/documents';
import type {
  BaseAgentToolOptions,
  DatabaseAiAdapter,
} from '@sqlrooms/mosaic/ai';
import {AiAgentError} from '@sqlrooms/mosaic/ai';
import {MosaicDashboardStoreState} from '@sqlrooms/mosaic';
import {calculateAgentResultMetadata} from '@sqlrooms/mosaic/ai';
import {createChartToolsInstructions} from '@sqlrooms/mosaic';
import {BLOCK_DOCUMENT_CHART_TOOL_PREFIX} from '@sqlrooms/mosaic/ai';
import {resolveChartTypes} from '@sqlrooms/mosaic';
import {AgentIntentSchemaFields} from '@sqlrooms/mosaic/ai';

const WORKSHEET_AGENT_TOOL_NAME = 'worksheet_agent';
const EMBEDDED_DASHBOARD_AGENT_TOOL_NAME = 'embedded_dashboard_agent';
const EMBEDDED_HTML_APP_AGENT_TOOL_NAME = 'embedded_html_app_agent';

const KnownWorksheetTools = {
  list_blocks: 'list_block_document_blocks',
  add_text_block: 'add_block_document_text_block',
  add_dashboard_block: 'add_mosaic_dashboard_block',
  add_html_app_block: 'add_html_app_block',
  add_data_table_explorer: 'add_data_table_explorer_block',
  embedded_dashboard_agent: EMBEDDED_DASHBOARD_AGENT_TOOL_NAME,
  embedded_html_app_agent: EMBEDDED_HTML_APP_AGENT_TOOL_NAME,
} as const;

type WorksheetAgentResult = {
  success: boolean;
  finalOutput: string;
  worksheetId: string;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    [key: string]: unknown;
  };
};

type ExtraWorksheetAiToolsFactory = () => Record<string, Tool>;

export type CreateWorksheetAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    blockDocumentAdapter: BlockDocumentAiAdapter;
    blockDocumentId: string;
    databaseAdapter: DatabaseAiAdapter;
    dashboardAgentTool: Tool;
    chartToolsOptions?: {
      chartTypes?: string[];
      chartMaxDataPoints?: number;
    };
    extraTools?: ExtraWorksheetAiToolsFactory;
    worksheetTools: Record<string, Tool>;
  };

function getWorksheetAgentInstructions<TState>(
  options: CreateWorksheetAgentToolOptions<TState>,
): string {
  const chartTools = resolveChartTypes(options.chartToolsOptions?.chartTypes);

  const chartToolsInstructions = createChartToolsInstructions(
    chartTools,
    BLOCK_DOCUMENT_CHART_TOOL_PREFIX,
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
7. If the user asks to add a map or geospatial visualization to a worksheet dashboard, use a dashboard block and ${KnownWorksheetTools.embedded_dashboard_agent}; worksheet chart tools cannot create map panels.
8. If the user asks for an HTML app, D3 app, Chart.js app, browser app, custom interactive visualization, or generated app inside a worksheet, use ${KnownWorksheetTools.add_html_app_block} + ${KnownWorksheetTools.embedded_html_app_agent}. Do not create a top-level html-app artifact from inside worksheet_agent.

## Creating Blocks

### Existing Blocks
Before updating a worksheet dashboard, adding a map to an existing worksheet, or updating an existing worksheet HTML app, call ${KnownWorksheetTools.list_blocks} to find existing dashboard/html-app blocks and their resource IDs.

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
- Use the dashboard block's dashboardId when calling ${KnownWorksheetTools.embedded_dashboard_agent}

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

### HTML App Blocks
To create a custom embedded browser app inside the worksheet, use a TWO-STEP workflow:

If the worksheet already has an html-app block that matches the request, reuse it:
- Call ${KnownWorksheetTools.list_blocks}
- Use the html-app block's htmlAppId as appId when calling ${KnownWorksheetTools.embedded_html_app_agent}

STEP 1: Create the empty html-app block container
- Call ${KnownWorksheetTools.add_html_app_block} with:
  - appTitle: title for the app
  - intent: durable purpose for this app block
- This returns an appId

STEP 2: Write the app files and observe runtime diagnostics
- Call ${KnownWorksheetTools.embedded_html_app_agent} with:
  - appId: the ID from step 1
  - intent: what app or visualization to create

## Workflows

### Direct Requests
When user asks for specific charts:
1. DO NOT run exploratory queries - go straight to creating charts
2. Call create_block_document_chart_* for each chart mentioned
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
3. Call create_block_document_chart_* multiple times for different visualizations
4. AVOID: Long text narratives, extensive query exploration, creating text blocks instead of charts
5. SUCCESS CRITERIA: Worksheet contains 3+ interactive visualizations with summaries and context

## Output Format
Return a summary of what was created in the worksheet.`;
}

const WorksheetAgentInputParams = z.object({
  worksheetTitle: z
    .string()
    .optional()
    .describe('Optional worksheet title if creating new worksheet'),
  tableName: z
    .string()
    .optional()
    .describe('Optional primary table/dataset name'),
  ...AgentIntentSchemaFields,
});

type WorksheetAgentInputParams = z.infer<typeof WorksheetAgentInputParams>;

export function createWorksheetAgentTool<
  TState extends MosaicDashboardStoreState,
>(
  options: CreateWorksheetAgentToolOptions<TState>,
): Tool<WorksheetAgentInputParams, WorksheetAgentResult> {
  const blockDocumentId = options.blockDocumentId;

  return tool({
    description: `Create or update a worksheet with charts, text blocks, and interactive components.
Use this to build data visualization worksheets with multiple chart blocks showing different aspects of the data.`,
    inputSchema: WorksheetAgentInputParams,
    execute: async (params): Promise<WorksheetAgentResult> => {
      const startTime = Date.now();

      try {
        options.blockDocumentAdapter.ensureBlockDocument(blockDocumentId);
        options.blockDocumentAdapter.setCurrentBlockDocument?.(blockDocumentId);

        const instructions = getWorksheetAgentInstructions(options);
        const model = options.getModel({
          state: options.store.getState(),
          storeApi: options.store,
        });

        const dataTools = options.createDataTools({
          state: options.store.getState(),
          storeApi: options.store,
        });

        const extraTools = options.extraTools?.() || {};

        const agent = new ToolLoopAgent({
          model,
          tools: {
            ...dataTools,
            ...options.worksheetTools,
            ...extraTools,
          },
          system: instructions,
          loopControlAgent: {
            maxIterations: 50,
            stopCondition: (toolCalls) => stepCountIs(toolCalls, 20),
          },
        });

        const result = await agent.run({
          prompt: params.intent || 'Create worksheet content',
        });

        const finalOutput = result.text || 'Worksheet created';
        const duration = Date.now() - startTime;

        return {
          success: true,
          finalOutput,
          worksheetId: blockDocumentId,
          metadata: calculateAgentResultMetadata({
            startTime,
            result,
          }),
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof AiAgentError) {
          return {
            success: false,
            finalOutput: error.finalOutput || '',
            worksheetId: blockDocumentId,
            error: error.message,
            metadata: error.metadata,
          };
        }

        return {
          success: false,
          finalOutput: '',
          worksheetId: blockDocumentId,
          error: error instanceof Error ? error.message : String(error),
          metadata: {duration},
        };
      }
    },
  });
}
