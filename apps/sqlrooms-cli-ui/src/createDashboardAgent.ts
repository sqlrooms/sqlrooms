import {tool} from 'ai';
import {z} from 'zod';
import {LanguageModel, ToolLoopAgent, stepCountIs} from 'ai';
import {StoreApi} from 'zustand';
import {RoomState} from './store-types';
import {createDashboardAiTools} from './createDashboardAiTools';
import {streamSubAgent, createDefaultAiTools, AiSliceState} from '@sqlrooms/ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {DASHBOARD_AGENT_INSTRUCTIONS} from './dashboardAgentInstructions';

const DashboardAgentInputSchema = z.object({
  reasoning: z
    .string()
    .describe('Reasoning for why the dashboard agent is being called'),
  prompt: z
    .string()
    .describe('The exploratory data analysis prompt for the agent'),
  tableName: z
    .string()
    .describe(
      'REQUIRED: The name of the table/dataset to analyze. Extract this from the user request (e.g., "earthquakes" from "analyze earthquakes dataset").',
    ),
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

interface DashboardAgentResult {
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
}

/**
 * Custom exception for dashboard agent execution errors.
 */
class DashboardAgentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardAgentException';
  }
}

/**
 * Helper to resolve the current model from the store.
 */
function getModel(store: StoreApi<AiSliceState>): LanguageModel {
  const state = store.getState();
  const currentSession = state.ai.getCurrentSession();
  const provider = currentSession?.modelProvider || 'openai';
  const modelId = currentSession?.model || 'gpt-4.1';

  return createOpenAICompatible({
    apiKey: state.ai.getApiKeyFromSettings(),
    name: provider || '',
    baseURL: state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
  }).chatModel(modelId);
}

/**
 * Build a context-aware prompt for the dashboard agent with table metadata.
 */
function buildAgentPrompt(
  userPrompt: string,
  tableName: string,
  state: RoomState,
): string {
  const table = state.db.tables.find((t) => t.tableName === tableName);
  const columnNames =
    table?.columns?.map((c) => c.name).join(', ') || 'unknown';
  const rowCount = table?.rowCount;
  const rowInfo = rowCount !== undefined ? `Approximate rows: ${rowCount}` : '';

  return `Analyze the "${tableName}" table.

Table info:
- Columns: ${columnNames}${rowInfo ? `\n- ${rowInfo}` : ''}

User request: ${userPrompt}

Focus on discovering meaningful patterns and creating visualizations that tell a clear story.`;
}

/**
 * Count panels in a dashboard.
 */
function countPanelsInDashboard(state: RoomState, dashboardId: string): number {
  const dashboard = state.mosaicDashboard.getDashboard(dashboardId);
  return dashboard?.panels?.length || 0;
}

/**
 * Validate that a table exists in the database.
 * @throws {DashboardAgentException} if table is not found
 */
function validateTableExists(state: RoomState, tableName: string): void {
  const tables = state.db.tables;
  const table = tables.find((t) => t.tableName === tableName);

  if (!table) {
    const availableTables = tables.map((t) => t.tableName).join(', ');
    throw new DashboardAgentException(
      `Table "${tableName}" not found. Available tables: ${availableTables || '(none)'}`,
    );
  }
}

/**
 * Get existing dashboard or create a new one.
 * @returns dashboard artifact ID
 */
function getOrCreateDashboard(
  state: RoomState,
  tableName: string,
  dashboardTitle?: string,
): string {
  const dashboardId = state.dashboard.getCurrentDashboardArtifactId() || '';

  if (dashboardId) {
    return dashboardId;
  }

  const suggestedTitle =
    dashboardTitle ||
    `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Insights`;

  const newDashboardId = state.dashboard.createDashboardArtifact(
    suggestedTitle,
    'grid',
  );
  state.artifacts.setCurrentArtifact(newDashboardId);

  return newDashboardId;
}

/**
 * Create a ToolLoopAgent configured for dashboard creation.
 * @returns configured ToolLoopAgent instance
 */
function createDashboardAgentInstance(
  store: StoreApi<RoomState>,
  maxSteps?: number,
  temperature?: number,
) {
  const tools = {
    ...createDefaultAiTools(store, {query: {}}),
    ...createDashboardAiTools(store),
  };

  const clampedMaxSteps = Math.max(5, Math.min(50, maxSteps ?? 20));
  const clampedTemperature = Math.max(0, Math.min(1, temperature ?? 0.7));

  return new ToolLoopAgent({
    model: getModel(store),
    tools,
    temperature: clampedTemperature,
    stopWhen: [stepCountIs(clampedMaxSteps)],
    instructions: DASHBOARD_AGENT_INSTRUCTIONS,
  });
}

/**
 * Calculate metadata about the agent execution.
 */
function calculateAgentMetadata(
  state: RoomState,
  dashboardId: string,
  tableName: string,
  agentToolCalls: Array<{toolName: string}>,
): DashboardAgentResult['metadata'] {
  const panelsCreated = countPanelsInDashboard(state, dashboardId);
  const stepsExecuted = agentToolCalls?.length || 0;
  const queriesRun =
    agentToolCalls?.filter((call) => call.toolName === 'query').length || 0;

  return {
    tableName,
    panelsCreated,
    stepsExecuted,
    queriesRun,
  };
}

export function dashboardAgentTool(store: StoreApi<RoomState>) {
  return tool({
    description: `An AI agent that explores datasets and creates comprehensive dashboards with multiple visualizations.

Use this for exploratory data analysis tasks like "analyze the earthquakes dataset" or "create insights dashboard for sales data".

The agent will query the data, discover patterns, and create charts, profilers, and text panels with findings.

For simple tasks like "create a histogram of magnitude", use the individual chart tools instead.

IMPORTANT: Always provide tableName parameter when the user mentions a specific dataset.`,
    inputSchema: DashboardAgentInputSchema,
    execute: async (params, options): Promise<DashboardAgentResult> => {
      const {prompt, tableName, dashboardTitle, maxSteps, temperature} = params;

      try {
        const state = store.getState();

        // 1. Validate table exists
        validateTableExists(state, tableName);

        // 2. Create or get dashboard artifact
        const dashboardId = getOrCreateDashboard(
          state,
          tableName,
          dashboardTitle,
        );

        // 3. Set selected table
        state.mosaicDashboard.setSelectedTable(dashboardId, tableName);

        // 4. Create agent with dashboard tools + query tool
        const dashboardAgent = createDashboardAgentInstance(
          store,
          maxSteps,
          temperature,
        );

        // 5. Build context-aware prompt with table metadata
        const fullPrompt = buildAgentPrompt(prompt, tableName, state);

        // 6. Execute agent
        const result = await streamSubAgent(
          dashboardAgent,
          fullPrompt,
          store,
          options?.toolCallId || '',
          options?.abortSignal,
        );

        // 7. Calculate metadata
        const finalState = store.getState();
        const metadata = calculateAgentMetadata(
          finalState,
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
        // Handle DashboardAgentException and other errors
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const friendlyMessage =
          error instanceof DashboardAgentException
            ? errorMessage
            : 'Dashboard agent execution failed.';

        return {
          success: false,
          finalOutput: friendlyMessage,
          dashboardId: '',
          error: errorMessage,
        };
      }
    },
  });
}
