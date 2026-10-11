import type {UIMessagePart} from '@sqlrooms/ai-config';
import type {AgentToolCall, ToolRendererRegistry} from '../types';
import type {HoistableToolCall} from './collectHoistableRenderers';
import {
  buildChatTurnModel,
  splitTextAroundHoists,
  type ChatTurnActivityItem,
  type ChatTurnTextItem,
  type ToolPartWithId,
} from './buildChatTurnModel';

export type {ToolPartWithId, ChatTurnActivityItem, ChatTurnTextItem};
export {isAgentToolPart} from './buildChatTurnModel';

/**
 * Chronological presentation plan derived from {@link buildChatTurnModel}.
 *
 * Prefer {@link buildChatTurnModel} for new code. This adapter preserves the
 * activity → response → hoisted → summary projection used by chronological
 * recipes and existing tests.
 */
export type ChatTurnRenderPlan = {
  /** Reasoning + tool/agent activity in source order. */
  activity: ChatTurnActivityItem[];
  /** Orchestrator text before the first hoist-producing call. */
  responseText: ChatTurnTextItem[];
  /** Hoisted tool renderers in execution order (deduped by toolCallId). */
  hoisted: HoistableToolCall[];
  /** Orchestrator text after the first hoist-producing call. */
  summaryText: ChatTurnTextItem[];
  /** Leaf tool count for the activity summary label. */
  leafToolCount: number;
  /** True when any activity tool is still pending. */
  isActivityRunning: boolean;
};

/**
 * Build a deterministic chronological turn presentation plan:
 * activity → response text → hoisted UI → summary text.
 */
export function buildChatTurnRenderPlan(options: {
  parts: UIMessagePart[];
  agentProgress: Record<string, AgentToolCall[]>;
  toolRenderers: ToolRendererRegistry;
  hoistableToolNames: ReadonlySet<string>;
}): ChatTurnRenderPlan {
  const model = buildChatTurnModel(options);
  const {responseText, summaryText} = splitTextAroundHoists(model);
  return {
    activity: model.activity,
    responseText,
    hoisted: model.hoisted,
    summaryText,
    leafToolCount: model.leafToolCount,
    isActivityRunning: model.isActivityRunning,
  };
}
