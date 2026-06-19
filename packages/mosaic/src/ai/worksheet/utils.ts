import {AgentToolCall} from '../types';
import {
  WorksheetAgentResultMetadata,
  WorksheetAiAdapter,
} from './worksheet-types';

export function calculateWorksheetAgentResultMetadata(
  worksheetAdapter: WorksheetAiAdapter,
  worksheetId: string,
  agentToolCalls: AgentToolCall[] = [],
): WorksheetAgentResultMetadata {
  const blocks = worksheetAdapter.getBlocks(worksheetId);

  return {
    blocksCreated: blocks?.length || 0,
    stepsExecuted: agentToolCalls.length,
    queriesRun: agentToolCalls.filter((call) => call.toolName === 'query')
      .length,
  };
}
