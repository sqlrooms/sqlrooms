import {MosaicDashboardPanelConfig} from '../dashboard/dashboard-types';
import {AiAgentError} from './errors';
import {DashboardAiAdapter} from './dashboard/dashboard-types';
import {DataTable} from '@sqlrooms/duckdb';
import {Tool} from 'ai';
import {DatabaseAiAdapter} from './database-types';
import {AgentResultMetadata} from './tool-types';
import {AgentToolCall} from './types';

/**
 * Validates that a table exists. Throws if not found.
 */
export function ensureTable(
  adapter: DatabaseAiAdapter,
  tableName: string,
): DataTable {
  const table = adapter.findTable(tableName);

  if (!table) {
    throw new AiAgentError(`Table "${tableName}" not found.`);
  }

  return table;
}

/**
 * Validates that a panel exists in a dashboard. Throws if not found.
 */
export function ensurePanel(
  adapter: DashboardAiAdapter,
  panelId: string,
  type?: string,
): MosaicDashboardPanelConfig {
  const panel = adapter.getPanel(panelId);

  if (!panel) {
    throw new AiAgentError(`Panel not found.`);
  }

  if (type !== undefined && panel.type !== type) {
    throw new AiAgentError(
      `Panel is of type "${panel.type}", expected type "${type}".`,
    );
  }

  return panel;
}

/**
 * Validates that extra tools do not override built-in tools.
 * Prevents accidental shadowing of core functionality by custom tools.
 *
 * @param builtInTools - Record of built-in tool names to tools
 * @param extraTools - Record of extra tool names to tools being registered
 * @throws {AiAgentError} When a key from extraTools exists in builtInTools
 */
export function ensureNoOverride(
  builtInTools: Record<string, Tool>,
  extraTools: Record<string, Tool>,
) {
  for (const key of Object.keys(extraTools)) {
    if (key in builtInTools) {
      throw new AiAgentError(
        `Dashboard extraTools cannot override built-in tool "${key}". Register the host tool under a unique key.`,
      );
    }
  }
}

/**
 * Calculate metadata about agent execution results.
 *
 * @param tableName - Optional table name associated with the agent execution
 * @param agentToolCalls - Array of tool calls made during agent execution
 * @returns Metadata including steps executed and queries run
 */
export function calculateAgentResultMetadata(
  tableName: string | undefined,
  agentToolCalls: AgentToolCall[] = [],
): AgentResultMetadata {
  return {
    tableName,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}
