import type {
  DashboardAgentResultMetadata,
  DashboardAiAdapter,
} from './dashboard-types';
import {AgentToolCall} from '../types';

export function calculateDashboardAgentResultMetadata(
  adapter: DashboardAiAdapter,
  tableName: string,
  agentToolCalls: AgentToolCall[] = [],
): DashboardAgentResultMetadata {
  const dashboard = adapter.getDashboard();

  return {
    tableName,
    panelsCreated: dashboard?.panels?.length || 0,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}
