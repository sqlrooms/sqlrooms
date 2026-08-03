import type {AgentToolCall, ToolRenderer, ToolRendererRegistry} from '../types';

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
  approvalId?: string;
};

/**
 * Whether a registered renderer wants this particular call hoisted into the
 * turn body. Defaults to true when no `shouldHoist` predicate is attached.
 *
 * Dispatcher tools (e.g. `executeApi`) attach `shouldHoist` so calls that
 * render nothing are kept in the activity timeline instead of emitting empty
 * hoisted slots that add flex gap spacing.
 */
export function toolRendererAllowsHoist(
  renderer: ToolRenderer<any> | undefined,
  args: {
    output: unknown;
    input: unknown;
    state: AgentToolCall['state'];
  },
): boolean {
  if (!renderer) return false;
  const shouldHoist = renderer.shouldHoist;
  if (typeof shouldHoist !== 'function') return true;
  return shouldHoist(args);
}

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
  const seen = new Set<string>();

  const visit = (calls: AgentToolCall[]) => {
    for (const tc of calls) {
      const isAgent =
        tc.toolName.startsWith('agent-') ||
        (agentProgress[tc.toolCallId]?.length ?? 0) > 0 ||
        (tc.agentToolCalls?.length ?? 0) > 0;

      if (isAgent) {
        const nestedCalls =
          agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? [];
        visit(nestedCalls);
      } else if (
        hoistableToolNames.has(tc.toolName) &&
        // Match HoistedToolCallRenderer's gate: only success / approval
        // states produce output. Pending/error states return null, so
        // collecting them would emit empty wrapper divs (and add spurious
        // gap spacing) for every in-progress or failed nested tool.
        (tc.state === 'success' || tc.state === 'approval-requested') &&
        toolRendererAllowsHoist(toolRenderers[tc.toolName], {
          output: tc.output,
          input: tc.input,
          state: tc.state,
        })
      ) {
        if (seen.has(tc.toolCallId)) continue;
        seen.add(tc.toolCallId);
        result.push({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          output: tc.output,
          input: tc.input,
          errorText: tc.errorText,
          state: tc.state,
          approvalId: tc.approvalId,
        });
      }
    }
  };

  visit(toolCalls);
  return result;
}
