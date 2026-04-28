import type {UIMessagePart} from 'ai';
import type {AgentToolCall} from '../../types';

/**
 * Convert a UI-message tool part (`tool-*` or `dynamic-tool`) into the
 * `AgentToolCall` shape expected by `ToolRenderBehavior` callbacks. Returns
 * `null` if the part doesn't carry a tool call (no `toolCallId`).
 */
export function partToAgentToolCall(
  part: UIMessagePart<any, any>,
): AgentToolCall | null {
  const type = (part as {type?: string}).type ?? '';
  const toolCallId = (part as {toolCallId?: string}).toolCallId;
  if (!toolCallId) return null;

  const toolName =
    type === 'dynamic-tool'
      ? ((part as {toolName?: string}).toolName ?? 'tool')
      : type.replace(/^tool-/, '') || 'tool';

  return {
    toolCallId,
    toolName,
    input: (part as {input?: unknown}).input,
    output: (part as {output?: unknown}).output,
    errorText: (part as {errorText?: string}).errorText,
    state: mapPartStateToToolCallState((part as {state?: string}).state),
  };
}

function mapPartStateToToolCallState(
  partState: string | undefined,
): AgentToolCall['state'] {
  switch (partState) {
    case 'output-available':
      return 'success';
    case 'output-error':
    case 'output-denied':
      return 'error';
    case 'approval-requested':
      return 'approval-requested';
    default:
      return 'pending';
  }
}
