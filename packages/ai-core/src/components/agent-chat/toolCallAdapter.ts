import type {UIMessagePart} from 'ai';
import type {AgentToolCall} from '../../types';
import {isDynamicToolPart, isToolPart} from '../../utils';

/**
 * Convert a UI-message tool part (`tool-*` or `dynamic-tool`) into the
 * `AgentToolCall` shape expected by `ToolRenderBehavior` callbacks. Returns
 * `null` if the part doesn't carry a tool call (no `toolCallId`).
 */
export function partToAgentToolCall(
  part: UIMessagePart<any, any>,
): AgentToolCall | null {
  if (!isToolPart(part) && !isDynamicToolPart(part)) return null;

  const toolCallId = part.toolCallId;
  if (!toolCallId) return null;

  const toolName = isDynamicToolPart(part)
    ? (part.toolName ?? 'tool')
    : part.type.replace(/^tool-/, '') || 'tool';

  return {
    toolCallId,
    toolName,
    input: part.input,
    output: part.output,
    errorText: part.errorText,
    state: mapPartStateToToolCallState(part.state),
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
