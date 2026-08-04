import type {
  DynamicToolUIPart,
  ToolUIPart,
  UIMessagePart,
} from '@sqlrooms/ai-config';
import type {AgentToolCall, ToolRendererRegistry} from '../types';
import {
  isDynamicToolPart,
  isReasoningPart,
  isTextPart,
  isToolPart,
  shouldSuppressTextPart,
} from '../utils';
import {
  collectHoistableRenderers,
  toolRendererAllowsHoist,
  type HoistableToolCall,
} from './collectHoistableRenderers';

export type ToolPartWithId = ToolUIPart | DynamicToolUIPart;

export type ChatTurnActivityItem =
  | {kind: 'reasoning'; index: number; text: string}
  | {
      kind: 'tool';
      index: number;
      part: ToolPartWithId;
      state: AgentToolCall['state'];
      isAgent: boolean;
      /** Live or persisted child calls when this tool represents an agent. */
      agentToolCalls?: AgentToolCall[];
      /** True when this top-level tool is collected into the hoisted region. */
      isHoisted: boolean;
    };

export type ChatTurnTextItem = {
  index: number;
  text: string;
};

/**
 * Interleaved segments used by the SQLRooms default turn recipe.
 * Consecutive non-agent tools form a tool-group; agents and other parts
 * break the group.
 */
export type ChatTurnSegment =
  | {kind: 'other'; part: UIMessagePart; index: number}
  | {kind: 'agent-tool'; part: ToolPartWithId; index: number}
  | {kind: 'tool-group'; parts: Array<{part: ToolPartWithId; index: number}>};

/**
 * Presentation-neutral semantic model for one chat turn.
 *
 * Owns classification, nesting signals, status, chronological activity,
 * interleaved grouping, hoist eligibility, counts, and timing inputs.
 * Visual order and labels are left to presentation recipes.
 */
export type ChatTurnModel = {
  /** Reasoning + tool/agent activity in source order. */
  activity: ChatTurnActivityItem[];
  /** Non-suppressed text parts in source order. */
  textItems: ChatTurnTextItem[];
  /** Interleaved segments for the default SQLRooms recipe. */
  segments: ChatTurnSegment[];
  /** Hoisted tool renderers in execution order (deduped by toolCallId). */
  hoisted: HoistableToolCall[];
  /** Index of the first part that produced a hoisted renderer, if any. */
  firstHoistPartIndex: number | null;
  /** Leaf tool count for summary labels. */
  leafToolCount: number;
  /** True when any activity tool is still pending. */
  isActivityRunning: boolean;
  /** Tool call ids contributing to turn-level timing aggregation. */
  timingToolCallIds: string[];
  suppressedIndices: ReadonlySet<number>;
};

/** Return the normalized tool name for a static or dynamic UI tool part. */
export function getToolName(part: UIMessagePart): string | undefined {
  if (isDynamicToolPart(part)) return part.toolName;
  if (isToolPart(part)) return part.type.replace(/^tool-/, '') || undefined;
  return undefined;
}

/** Whether a UI tool part represents an agent with nested tool activity. */
export function isAgentToolPart(
  part: UIMessagePart,
  agentProgress: Record<string, AgentToolCall[] | unknown[]>,
): boolean {
  const name = getToolName(part);
  if (!name) return false;
  if (name.startsWith('agent-')) return true;

  const toolCallId = (part as {toolCallId?: string}).toolCallId;
  if (toolCallId && (agentProgress[toolCallId]?.length ?? 0) > 0) return true;

  const output = (part as {output?: {agentToolCalls?: unknown[]}}).output;
  if (output?.agentToolCalls?.length) return true;

  return false;
}

/** Normalize an AI SDK UI tool state to SQLRooms' agent tool state. */
export function mapUiToolStateToAgentState(
  state: string,
): AgentToolCall['state'] {
  if (state === 'output-available') {
    return 'success';
  }
  if (state === 'output-error' || state === 'output-denied') {
    return 'error';
  }
  if (state === 'approval-requested') {
    return 'approval-requested';
  }
  return 'pending';
}

function isToolPending(state: string): boolean {
  return (
    state !== 'output-available' &&
    state !== 'output-error' &&
    state !== 'output-denied'
  );
}

function getAgentNestedCalls(
  part: ToolPartWithId,
  agentProgress: Record<string, AgentToolCall[]>,
): AgentToolCall[] {
  const fromProgress = agentProgress[part.toolCallId];
  if (fromProgress !== undefined) return fromProgress;
  const output = part.state === 'output-available' ? part.output : undefined;
  const agentOutput = output as {agentToolCalls?: AgentToolCall[]} | undefined;
  return agentOutput?.agentToolCalls ?? [];
}

function countLeafToolsWithProgress(
  calls: AgentToolCall[],
  agentProgress: Record<string, AgentToolCall[]>,
): number {
  let count = 0;
  for (const tc of calls) {
    const nested = agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? [];
    const isAgent =
      tc.toolName.startsWith('agent-') ||
      nested.length > 0 ||
      (agentProgress[tc.toolCallId]?.length ?? 0) > 0;
    if (isAgent) {
      count += countLeafToolsWithProgress(nested, agentProgress);
    } else {
      count += 1;
    }
  }
  return count;
}

function areAnyNestedPending(
  calls: AgentToolCall[],
  agentProgress: Record<string, AgentToolCall[]>,
): boolean {
  for (const tc of calls) {
    if (tc.state === 'pending' || tc.state === 'approval-requested') {
      return true;
    }
    const nested = agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? [];
    if (nested.length > 0 && areAnyNestedPending(nested, agentProgress)) {
      return true;
    }
  }
  return false;
}

function hoistableFromToolPart(
  part: ToolPartWithId,
  toolName: string,
): HoistableToolCall {
  const output =
    part.state === 'output-available'
      ? (part as {output?: unknown}).output
      : undefined;
  const errorText =
    part.state === 'output-error'
      ? (part as {errorText?: string}).errorText
      : undefined;
  const approvalId =
    part.state === 'approval-requested' && 'approval' in part && part.approval
      ? part.approval.id
      : undefined;

  return {
    toolCallId: part.toolCallId,
    toolName,
    output,
    input: part.input,
    errorText,
    state: mapUiToolStateToAgentState(part.state),
    approvalId,
  };
}

function dedupeHoisted(items: HoistableToolCall[]): HoistableToolCall[] {
  const seen = new Set<string>();
  const result: HoistableToolCall[] = [];
  for (const item of items) {
    if (seen.has(item.toolCallId)) continue;
    seen.add(item.toolCallId);
    result.push(item);
  }
  return result;
}

function collectNestedToolCallIds(
  calls: AgentToolCall[],
  agentProgress: Record<string, AgentToolCall[]>,
  into: Set<string>,
): void {
  for (const tc of calls) {
    into.add(tc.toolCallId);
    const nested = agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? [];
    if (nested.length > 0) {
      collectNestedToolCallIds(nested, agentProgress, into);
    }
  }
}

function groupPartsIntoSegments(
  parts: UIMessagePart[],
  suppressedIndices: ReadonlySet<number>,
  agentProgress: Record<string, AgentToolCall[]>,
): ChatTurnSegment[] {
  const segments: ChatTurnSegment[] = [];
  let pendingTools: Array<{part: ToolPartWithId; index: number}> = [];

  const flushTools = () => {
    if (pendingTools.length > 0) {
      segments.push({kind: 'tool-group', parts: pendingTools});
      pendingTools = [];
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (suppressedIndices.has(i)) continue;
    if (typeof part.type === 'string' && part.type.startsWith('step-')) {
      continue;
    }

    const isTool = isToolPart(part) || isDynamicToolPart(part);
    if (isTool && !isAgentToolPart(part, agentProgress)) {
      pendingTools.push({part: part as ToolPartWithId, index: i});
    } else if (isTool && isAgentToolPart(part, agentProgress)) {
      flushTools();
      segments.push({
        kind: 'agent-tool',
        part: part as ToolPartWithId,
        index: i,
      });
    } else {
      flushTools();
      segments.push({kind: 'other', part, index: i});
    }
  }
  flushTools();
  return segments;
}

function canHoistToolPart(
  part: ToolPartWithId,
  toolName: string,
  toolRenderers: ToolRendererRegistry,
  hoistableToolNames: ReadonlySet<string>,
): boolean {
  return (
    hoistableToolNames.has(toolName) &&
    (part.state === 'output-available' ||
      part.state === 'approval-requested') &&
    toolRendererAllowsHoist(toolRenderers[toolName], {
      output:
        part.state === 'output-available'
          ? (part as {output?: unknown}).output
          : undefined,
      input: part.input,
      state: mapUiToolStateToAgentState(part.state),
    })
  );
}

/**
 * Build a presentation-neutral semantic model for one assistant turn.
 */
export function buildChatTurnModel(options: {
  parts: UIMessagePart[];
  agentProgress: Record<string, AgentToolCall[]>;
  toolRenderers: ToolRendererRegistry;
  hoistableToolNames: ReadonlySet<string>;
}): ChatTurnModel {
  const {parts, agentProgress, toolRenderers, hoistableToolNames} = options;

  const suppressedIndices = new Set<number>();
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (isTextPart(part)) {
      const text = part.text?.trim();
      if (text && shouldSuppressTextPart(text, parts.slice(i + 1))) {
        suppressedIndices.add(i);
      }
    }
  }

  const activity: ChatTurnActivityItem[] = [];
  const textItems: ChatTurnTextItem[] = [];
  const hoisted: HoistableToolCall[] = [];
  const timingIds = new Set<string>();
  let firstHoistPartIndex: number | null = null;
  let leafToolCount = 0;
  let isActivityRunning = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (suppressedIndices.has(i)) continue;
    if (typeof part.type === 'string' && part.type.startsWith('step-')) {
      continue;
    }

    if (isReasoningPart(part)) {
      if (part.text.trim()) {
        activity.push({kind: 'reasoning', index: i, text: part.text});
      }
      continue;
    }

    if (isTextPart(part)) {
      textItems.push({index: i, text: part.text});
      continue;
    }

    if (!isToolPart(part) && !isDynamicToolPart(part)) {
      continue;
    }

    const toolPart = part as ToolPartWithId;
    const toolName = getToolName(toolPart);
    if (!toolName) continue;

    const isAgent = isAgentToolPart(toolPart, agentProgress);
    timingIds.add(toolPart.toolCallId);

    if (isToolPending(toolPart.state)) {
      isActivityRunning = true;
    }

    let isHoisted = false;

    const agentToolCalls = isAgent
      ? getAgentNestedCalls(toolPart, agentProgress)
      : undefined;

    if (agentToolCalls) {
      const nested = agentToolCalls;
      leafToolCount += countLeafToolsWithProgress(nested, agentProgress);
      if (areAnyNestedPending(nested, agentProgress)) {
        isActivityRunning = true;
      }
      collectNestedToolCallIds(nested, agentProgress, timingIds);

      const nestedHoisted = collectHoistableRenderers(
        nested,
        agentProgress,
        toolRenderers,
        hoistableToolNames,
      );
      if (nestedHoisted.length > 0) {
        if (firstHoistPartIndex === null) firstHoistPartIndex = i;
        hoisted.push(...nestedHoisted);
      }
    } else {
      leafToolCount += 1;
      isHoisted = canHoistToolPart(
        toolPart,
        toolName,
        toolRenderers,
        hoistableToolNames,
      );
      if (isHoisted) {
        if (firstHoistPartIndex === null) firstHoistPartIndex = i;
        hoisted.push(hoistableFromToolPart(toolPart, toolName));
      }
    }

    activity.push({
      kind: 'tool',
      index: i,
      part: toolPart,
      state: mapUiToolStateToAgentState(toolPart.state),
      isAgent,
      agentToolCalls,
      isHoisted,
    });
  }

  return {
    activity,
    textItems,
    segments: groupPartsIntoSegments(parts, suppressedIndices, agentProgress),
    hoisted: dedupeHoisted(hoisted),
    firstHoistPartIndex,
    leafToolCount,
    isActivityRunning,
    timingToolCallIds: [...timingIds],
    suppressedIndices,
  };
}

/**
 * Split text around the first hoist-producing call for chronological recipes.
 * When nothing is hoistable, all text stays in `responseText`.
 */
export function splitTextAroundHoists(model: ChatTurnModel): {
  responseText: ChatTurnTextItem[];
  summaryText: ChatTurnTextItem[];
} {
  const {textItems, hoisted, firstHoistPartIndex} = model;
  if (hoisted.length === 0 || firstHoistPartIndex === null) {
    return {responseText: textItems, summaryText: []};
  }

  const responseText: ChatTurnTextItem[] = [];
  const summaryText: ChatTurnTextItem[] = [];
  for (const item of textItems) {
    if (item.index < firstHoistPartIndex) {
      responseText.push(item);
    } else {
      summaryText.push(item);
    }
  }
  return {responseText, summaryText};
}

/** Compute the enclosing duration of the supplied recorded tool calls. */
export function computeComputationTimeMs(
  toolCallIds: Iterable<string>,
  toolTimings: Record<string, {startedAt?: number; completedAt?: number}>,
): number | undefined {
  let earliest: number | undefined;
  let latest: number | undefined;
  for (const id of toolCallIds) {
    const timing = toolTimings[id];
    if (timing?.startedAt == null) continue;
    earliest =
      earliest == null
        ? timing.startedAt
        : Math.min(earliest, timing.startedAt);
    const end = timing.completedAt ?? timing.startedAt;
    latest = latest == null ? end : Math.max(latest, end);
  }
  if (earliest == null || latest == null || latest < earliest) return undefined;
  return latest - earliest;
}
