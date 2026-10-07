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
 * Whether a normalized agent tool call can render in a hoisted-output region.
 * Pending and failed calls remain activity-only, matching the turn model.
 */
export function canHoistAgentToolCall(
  toolCall: Pick<AgentToolCall, 'toolName' | 'output' | 'input' | 'state'>,
  toolRenderers: ToolRendererRegistry,
  hoistableToolNames: ReadonlySet<string>,
): boolean {
  return (
    hoistableToolNames.has(toolCall.toolName) &&
    (toolCall.state === 'success' || toolCall.state === 'approval-requested') &&
    toolRendererAllowsHoist(toolRenderers[toolCall.toolName], {
      output: toolCall.output,
      input: toolCall.input,
      state: toolCall.state,
    })
  );
}

/** The hoisted-region item for a normalized tool call. */
export function toHoistableToolCall(tc: AgentToolCall): HoistableToolCall {
  return {
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    output: tc.output,
    input: tc.input,
    errorText: tc.errorText,
    state: tc.state,
    approvalId: tc.approvalId,
  };
}

/**
 * Recursively walk an AgentToolCall tree and collect every tool call that
 * has a registered renderer AND is in the explicit hoistable set.
 * Results are returned in depth-first order so they appear in the natural
 * execution sequence.
 *
 * A call that runs a sub-agent is collected too when it is listed, ahead of
 * its own nested outputs; its nested calls are always walked.
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
      if (
        !seen.has(tc.toolCallId) &&
        canHoistAgentToolCall(tc, toolRenderers, hoistableToolNames)
      ) {
        seen.add(tc.toolCallId);
        result.push(toHoistableToolCall(tc));
      }

      const isAgent =
        tc.toolName.startsWith('agent-') ||
        (agentProgress[tc.toolCallId]?.length ?? 0) > 0 ||
        (tc.agentToolCalls?.length ?? 0) > 0;
      if (isAgent) {
        visit(agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? []);
      }
    }
  };

  visit(toolCalls);
  return result;
}
