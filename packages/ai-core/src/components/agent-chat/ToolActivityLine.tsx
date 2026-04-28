import {cn} from '@sqlrooms/ui';
import type {UIMessagePart} from 'ai';
import type {FC} from 'react';
import {useToolRenderBehavior} from '../FlatAgentRenderer';
import type {AgentToolCall} from '../../types';
import {partToAgentToolCall} from './toolCallAdapter';

/**
 * One-line status row for a tool call: colored dot + label. Labels flow from
 * the ambient `ToolRenderBehavior`; the dot color reflects tool-call state.
 */
export const ToolActivityLine: FC<{part: UIMessagePart<any, any>}> = ({
  part,
}) => {
  const toolCall = partToAgentToolCall(part);
  const label = useToolLabel(toolCall);
  if (!toolCall) return null;

  return (
    <div
      className={cn(
        'border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
        toolCall.state === 'error' && 'text-destructive border-destructive/40',
      )}
    >
      <StatusDot state={toolCall.state} />
      <span className="truncate">{label}</span>
    </div>
  );
};

const StatusDot: FC<{state: AgentToolCall['state']}> = ({state}) => (
  <span
    className={cn(
      'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
      state === 'pending' && 'animate-pulse bg-amber-500',
      state === 'success' && 'bg-emerald-500',
      state === 'error' && 'bg-destructive',
      state === 'approval-requested' && 'bg-blue-500',
    )}
  />
);

/**
 * Derive the display label for a tool call, honoring the ambient
 * `ToolRenderBehavior` context. Pending tools fall back to "Thinking..."
 * until a better label is available.
 */
function useToolLabel(toolCall: AgentToolCall | null): string {
  const behavior = useToolRenderBehavior();
  if (!toolCall) return '';
  const custom =
    behavior.getActivityLabel?.(toolCall) ??
    behavior.getToolDisplayName?.(toolCall);
  if (custom) return custom;
  if (toolCall.state === 'pending') return 'Thinking...';
  return toolCall.toolName;
}
