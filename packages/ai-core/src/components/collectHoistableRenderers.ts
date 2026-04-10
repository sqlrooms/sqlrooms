import type {AgentToolCall} from '../agents/AgentUtils';
import type {ToolRendererRegistry} from '../types';

/**
 * A tool call whose registered renderer should be hoisted to the parent
 * level instead of being rendered nested inside an ActivityBox.
 */
export type HoistableToolCall = {
  toolCallId: string;
  toolName: string;
  output: unknown;
  input: unknown;
  errorText?: string;
  state: AgentToolCall['state'];
};

/**
 * Recursively walk an AgentToolCall tree and collect every tool call that
 * has a registered renderer AND is in the explicit hoistable set.
 * Results are returned in depth-first order so they appear in the natural
 * execution sequence.
 *
 * Agent tool calls (name starts with `agent-`) are never themselves
 * hoisted — only their leaf tool calls with renderers are collected.
 *
 * @param hoistableToolNames - Set of tool names whose renderers should be
 *   hoisted. If empty, nothing is hoisted (safe default). This is typically
 *   the `hoistedRenderers` list from the parent context.
 */
export function collectHoistableRenderers(
  toolCalls: AgentToolCall[],
  agentProgress: Record<string, AgentToolCall[]>,
  toolRenderers: ToolRendererRegistry,
  hoistableToolNames: ReadonlySet<string>,
): HoistableToolCall[] {
  const result: HoistableToolCall[] = [];

  for (const tc of toolCalls) {
    const isAgent =
      tc.toolName.startsWith('agent-') ||
      (agentProgress[tc.toolCallId]?.length ?? 0) > 0 ||
      (tc.agentToolCalls?.length ?? 0) > 0;

    if (isAgent) {
      const nestedCalls =
        agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? [];
      result.push(
        ...collectHoistableRenderers(
          nestedCalls,
          agentProgress,
          toolRenderers,
          hoistableToolNames,
        ),
      );
    } else if (
      hoistableToolNames.has(tc.toolName) &&
      typeof toolRenderers[tc.toolName] === 'function'
    ) {
      result.push({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        output: tc.output,
        input: tc.input,
        errorText: tc.errorText,
        state: tc.state,
      });
    }
  }

  return result;
}
