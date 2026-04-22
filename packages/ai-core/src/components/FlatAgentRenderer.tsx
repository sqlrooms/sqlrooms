import React, {createContext, useContext, useMemo} from 'react';
import {CircleXIcon, Loader2, CircleDotIcon, CircleIcon} from 'lucide-react';
import {formatShortDuration} from '@sqlrooms/utils';
import {cn, HoverCard, HoverCardContent, HoverCardTrigger} from '@sqlrooms/ui';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '../AiSlice';
import type {AgentToolCall} from '../types';
import {useElapsedTime} from '../hooks/useElapsedTime';
import {isDynamicToolPart, isToolPart} from '../utils';
import {useHoistedRenderers} from './HoistedRenderersContext';
import {ActivityBox} from './ActivityBox';
import {type HoistableToolCall} from './collectHoistableRenderers';
import {ToolCallErrorBoundary} from './tools/ToolResultErrorBoundary';

// ---------------------------------------------------------------------------
// Context for controlling ToolCallDetailHover visibility
// ---------------------------------------------------------------------------

const ShowToolCallDetailsContext = createContext(false);

export const ShowToolCallDetailsProvider = ShowToolCallDetailsContext.Provider;

function useShowToolCallDetails() {
  return useContext(ShowToolCallDetailsContext);
}

// ---------------------------------------------------------------------------
// Context for host-app-provided tool rendering behavior
// ---------------------------------------------------------------------------

/**
 * Controls the segment-tree structure: which tool calls are treated as
 * transparent wrappers whose children are promoted to the caller's level.
 *
 * - `isPassthroughTool`: when true, no summary line is rendered and nested
 *   calls are flattened into the parent's segment list.
 */
export type ToolStructureBehavior = {
  isPassthroughTool?: (toolCall: AgentToolCall) => boolean;
};

/**
 * Controls how tool calls are labeled in the UI. All callbacks return
 * `undefined` to fall back to the renderer's default.
 *
 * - `getToolDisplayName`: label for agent summary lines (ParentSummaryLine).
 *   Falls back to the raw tool name.
 * - `getActivityLabel`: label for leaf activity log lines (ActivityLogLine,
 *   OrchestratorLogLineInner). Falls back to `reasoning` input field, then
 *   "Thinking..." while pending, then the raw tool name.
 */
export type ToolDisplayBehavior = {
  getToolDisplayName?: (toolCall: AgentToolCall) => string | undefined;
  getActivityLabel?: (toolCall: AgentToolCall) => string | undefined;
};

/** Combined structural + display customization passed via Chat.Root. */
export type ToolRenderBehavior = ToolStructureBehavior & ToolDisplayBehavior;

const ToolRenderBehaviorContext = createContext<ToolRenderBehavior>({});

export const ToolRenderBehaviorProvider = ToolRenderBehaviorContext.Provider;

function useToolRenderBehavior(): ToolRenderBehavior {
  return useContext(ToolRenderBehaviorContext);
}

// ---------------------------------------------------------------------------
// Types for the flattened segment model
// ---------------------------------------------------------------------------

type AgentSegment = {
  kind: 'agent';
  toolCall: AgentToolCall;
  nestedCalls: AgentToolCall[];
};

type ToolGroupSegment = {
  kind: 'tool-group';
  tools: AgentToolCall[];
};

type FlatSegment = AgentSegment | ToolGroupSegment;

// ---------------------------------------------------------------------------
// ActivityLogLine — compact single-line entry inside an ActivityBox (leaf only)
// ---------------------------------------------------------------------------

const ActivityLogLine: React.FC<{
  toolCall: AgentToolCall;
}> = ({toolCall}) => {
  const showDetails = useShowToolCallDetails();
  const {getActivityLabel} = useToolRenderBehavior();
  const isSuccess = toolCall.state === 'success';
  const isError = toolCall.state === 'error';
  const isPending = toolCall.state === 'pending';

  const inputObj =
    toolCall.input && typeof toolCall.input === 'object'
      ? (toolCall.input as Record<string, unknown>)
      : undefined;
  const reasoning = inputObj?.reasoning as string | undefined;

  const label =
    reasoning ??
    (getActivityLabel ? getActivityLabel(toolCall) : undefined) ??
    (isPending ? 'Thinking...' : toolCall.toolName);

  return (
    <div
      className={cn(
        'grid min-w-0 items-start gap-x-1.5 overflow-hidden py-0.5',
        showDetails
          ? 'grid-cols-[14px_minmax(0,1fr)_auto_auto]'
          : 'grid-cols-[14px_minmax(0,1fr)_auto]',
        !isError && 'text-muted-foreground',
      )}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center">
        {isPending && (
          <Loader2 className="text-muted-foreground/50 h-3 w-3 animate-spin" />
        )}
        {isSuccess && (
          <CircleIcon className="text-muted-foreground/40 h-1.5 w-1.5 fill-current" />
        )}
        {isError && <CircleXIcon className="h-3 w-3" />}
      </span>
      <span
        className={cn(
          'min-w-0 leading-4 break-all whitespace-normal',
          reasoning && 'italic',
        )}
      >
        {label}
      </span>
      {toolCall.startedAt != null ? (
        <LogLineElapsed
          startedAt={toolCall.startedAt}
          completedAt={toolCall.completedAt}
        />
      ) : (
        <span />
      )}
      {showDetails && <ToolCallDetailHover toolCall={toolCall} />}
    </div>
  );
};

const LogLineElapsed: React.FC<{
  startedAt: number;
  completedAt?: number;
}> = ({startedAt, completedAt}) => {
  const isRunning = completedAt == null;
  const elapsed = useElapsedTime(isRunning, startedAt, completedAt);

  if (!isRunning) {
    return (
      <span className="text-muted-foreground/60 shrink-0 text-[10px]">
        {formatShortDuration(completedAt - startedAt)}
      </span>
    );
  }
  return elapsed ? (
    <span className="text-muted-foreground/60 shrink-0 text-[10px]">
      {elapsed}
    </span>
  ) : null;
};

// ---------------------------------------------------------------------------
// ParentSummaryLine — summary line for an agent
// ---------------------------------------------------------------------------

const ParentSummaryLine: React.FC<{
  toolCallId: string;
  toolName: string;
  isComplete: boolean;
  startedAt?: number;
  completedAt?: number;
  toolCall?: AgentToolCall;
}> = ({toolCallId, toolName, isComplete, startedAt, completedAt, toolCall}) => {
  const showDetails = useShowToolCallDetails();
  const {getToolDisplayName} = useToolRenderBehavior();
  const timing = useStoreWithAi((s) => s.ai.toolTimings[toolCallId]);
  const effectiveStartedAt = timing?.startedAt ?? startedAt;
  const effectiveCompletedAt = timing?.completedAt ?? completedAt;
  const elapsed = useElapsedTime(
    !isComplete,
    effectiveStartedAt,
    effectiveCompletedAt,
  );
  const displayName =
    (toolCall && getToolDisplayName
      ? getToolDisplayName(toolCall)
      : undefined) ?? toolName;

  return (
    <div
      className={cn(
        'grid min-w-0 items-start gap-x-2 py-1 text-xs',
        showDetails
          ? 'grid-cols-[16px_minmax(0,1fr)_auto_auto]'
          : 'grid-cols-[16px_minmax(0,1fr)_auto]',
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {!isComplete ? (
          <Loader2 className="text-muted-foreground/50 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CircleIcon className="text-muted-foreground/30 h-2 w-2 fill-current" />
        )}
      </span>
      <span className="min-w-0 leading-4 font-medium">{displayName}</span>
      {elapsed ? (
        <span className="text-muted-foreground/50 shrink-0 text-[11px] tabular-nums">
          {elapsed}
        </span>
      ) : effectiveStartedAt != null && effectiveCompletedAt != null ? (
        <span className="text-muted-foreground/50 shrink-0 text-[11px] tabular-nums">
          {formatShortDuration(effectiveCompletedAt - effectiveStartedAt)}
        </span>
      ) : (
        <span />
      )}
      {showDetails &&
        (toolCall ? <ToolCallDetailHover toolCall={toolCall} /> : <span />)}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ToolCallDetailHover — hover card showing tool call details
// ---------------------------------------------------------------------------

const ToolCallDetailHover: React.FC<{
  toolCall: AgentToolCall;
}> = ({toolCall}) => (
  <HoverCard openDelay={200} closeDelay={100}>
    <HoverCardTrigger asChild>
      <button className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 cursor-pointer transition-colors">
        <CircleDotIcon className="h-3 w-3" />
      </button>
    </HoverCardTrigger>
    <HoverCardContent side="top" className="w-72 p-2.5">
      <div className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
        {toolCall.toolName}
      </div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400">
        ID: {toolCall.toolCallId}
      </div>
      <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
        State:{' '}
        <span
          className={cn(
            toolCall.state === 'success' && 'text-green-600',
            toolCall.state === 'error' && 'text-red-600',
            toolCall.state === 'approval-requested' && 'text-amber-600',
            toolCall.state === 'pending' && 'text-yellow-600',
          )}
        >
          {toolCall.state}
        </span>
      </div>
      {toolCall.input != null && (
        <>
          <div className="mt-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
            Input
          </div>
          <pre className="mt-0.5 max-h-32 overflow-auto rounded bg-gray-50 p-1.5 font-mono text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            {typeof toolCall.input === 'string'
              ? toolCall.input
              : JSON.stringify(toolCall.input, null, 2)}
          </pre>
        </>
      )}
      {toolCall.output != null && (
        <>
          <div className="mt-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
            Output
          </div>
          <pre className="mt-0.5 max-h-32 overflow-auto rounded bg-gray-50 p-1.5 font-mono text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            {typeof toolCall.output === 'string'
              ? toolCall.output
              : JSON.stringify(toolCall.output, null, 2)}
          </pre>
        </>
      )}
      {toolCall.errorText && (
        <div className="mt-1.5 text-[10px] text-red-600">
          {toolCall.errorText}
        </div>
      )}
    </HoverCardContent>
  </HoverCard>
);

// ---------------------------------------------------------------------------
// HoistedRenderer — renders a single hoisted tool component
// ---------------------------------------------------------------------------

const HoistedRenderer: React.FC<{
  item: HoistableToolCall;
}> = ({item}) => {
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const ToolComponent = toolRenderers[item.toolName];

  if (!ToolComponent || typeof ToolComponent !== 'function') return null;

  const isApproval = item.state === 'approval-requested';
  if (item.state !== 'success' && !isApproval) return null;

  const mappedState = isApproval ? 'approval-requested' : 'output-available';

  return (
    <ToolCallErrorBoundary>
      <ToolComponent
        output={item.output}
        input={item.input}
        toolCallId={item.toolCallId}
        state={mappedState}
        errorText={item.errorText}
        approvalId={item.approvalId}
      />
    </ToolCallErrorBoundary>
  );
};

// ---------------------------------------------------------------------------
// Helper: determine if a tool call is a sub-agent
// ---------------------------------------------------------------------------

function isAgentCall(
  tc: AgentToolCall,
  agentProgress: Record<string, AgentToolCall[]>,
): boolean {
  return (
    tc.toolName.startsWith('agent-') ||
    (agentProgress[tc.toolCallId]?.length ?? 0) > 0 ||
    (tc.agentToolCalls?.length ?? 0) > 0
  );
}

function getNestedCalls(
  tc: AgentToolCall,
  agentProgress: Record<string, AgentToolCall[]>,
): AgentToolCall[] {
  return agentProgress[tc.toolCallId] ?? tc.agentToolCalls ?? [];
}

// ---------------------------------------------------------------------------
// buildFlatSegments — partition a list of tool calls into segments:
//   consecutive non-agent tools => ToolGroupSegment
//   agent calls => AgentSegment (recursed at render time)
// Tools flagged as passthrough by the host app are collapsed: their children
// are flattened into the caller's segment list so no summary line is emitted.
// ---------------------------------------------------------------------------

function buildFlatSegments(
  calls: AgentToolCall[],
  agentProgress: Record<string, AgentToolCall[]>,
  isPassthroughTool?: (tc: AgentToolCall) => boolean,
): FlatSegment[] {
  const segments: FlatSegment[] = [];
  let pendingTools: AgentToolCall[] = [];

  const flushTools = () => {
    if (pendingTools.length > 0) {
      segments.push({kind: 'tool-group', tools: pendingTools});
      pendingTools = [];
    }
  };

  for (const tc of calls) {
    if (isPassthroughTool?.(tc)) {
      const nested = getNestedCalls(tc, agentProgress);
      const nestedSegments = buildFlatSegments(
        nested,
        agentProgress,
        isPassthroughTool,
      );
      for (const seg of nestedSegments) {
        if (seg.kind === 'tool-group') {
          pendingTools.push(...seg.tools);
        } else {
          flushTools();
          segments.push(seg);
        }
      }
      continue;
    }

    if (isAgentCall(tc, agentProgress)) {
      flushTools();
      segments.push({
        kind: 'agent',
        toolCall: tc,
        nestedCalls: getNestedCalls(tc, agentProgress),
      });
    } else {
      pendingTools.push(tc);
    }
  }
  flushTools();

  return segments;
}

// ---------------------------------------------------------------------------
// FlatSegmentList — renders a list of segments recursively
// ---------------------------------------------------------------------------

const FlatSegmentList: React.FC<{
  segments: FlatSegment[];
  agentProgress: Record<string, AgentToolCall[]>;
  hoistableSet: ReadonlySet<string>;
  toolRenderers: Record<string, unknown>;
  isPassthroughTool?: (tc: AgentToolCall) => boolean;
}> = ({
  segments,
  agentProgress,
  hoistableSet,
  toolRenderers,
  isPassthroughTool,
}) => {
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === 'tool-group') {
          const anyPending = seg.tools.some(
            (t) => t.state === 'pending' || t.state === 'approval-requested',
          );

          return (
            <React.Fragment key={`tg-${idx}`}>
              <ActivityBox isRunning={anyPending}>
                {seg.tools.map((tc) => {
                  const isHoisted =
                    hoistableSet.has(tc.toolName) &&
                    typeof toolRenderers[tc.toolName] === 'function';
                  const hasNonHoistedRenderer =
                    !isHoisted &&
                    typeof toolRenderers[tc.toolName] === 'function';
                  return (
                    <React.Fragment key={tc.toolCallId}>
                      <ActivityLogLine toolCall={tc} />
                      {hasNonHoistedRenderer && (
                        <HoistedRenderer
                          item={{
                            toolCallId: tc.toolCallId,
                            toolName: tc.toolName,
                            output: tc.output,
                            input: tc.input,
                            errorText: tc.errorText,
                            state: tc.state,
                            approvalId: tc.approvalId,
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </ActivityBox>
              {seg.tools.map((tc) => {
                const isHoisted =
                  hoistableSet.has(tc.toolName) &&
                  typeof toolRenderers[tc.toolName] === 'function';
                if (!isHoisted) return null;
                return (
                  <HoistedRenderer
                    key={`hoisted-${tc.toolCallId}`}
                    item={{
                      toolCallId: tc.toolCallId,
                      toolName: tc.toolName,
                      output: tc.output,
                      input: tc.input,
                      errorText: tc.errorText,
                      state: tc.state,
                      approvalId: tc.approvalId,
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        }

        // Agent segment: render summary line, then recurse into sub-segments
        const {toolCall, nestedCalls} = seg;
        const isComplete =
          toolCall.state === 'success' || toolCall.state === 'error';

        const childSegments = buildFlatSegments(
          nestedCalls,
          agentProgress,
          isPassthroughTool,
        );

        return (
          <React.Fragment key={toolCall.toolCallId}>
            <ParentSummaryLine
              toolCallId={toolCall.toolCallId}
              toolName={toolCall.toolName}
              isComplete={isComplete}
              startedAt={toolCall.startedAt}
              completedAt={toolCall.completedAt}
              toolCall={toolCall}
            />
            <FlatSegmentList
              segments={childSegments}
              agentProgress={agentProgress}
              hoistableSet={hoistableSet}
              toolRenderers={toolRenderers}
              isPassthroughTool={isPassthroughTool}
            />
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// OrchestratorToolLogLine — compact log line for orchestrator-level tool parts
// Used by AnalysisResult to render non-agent tools inside an ActivityBox.
// ---------------------------------------------------------------------------

export const OrchestratorToolLogLine: React.FC<{
  part: UIMessagePart;
  toolCallId: string;
}> = ({part, toolCallId}) => {
  if (!isToolPart(part) && !isDynamicToolPart(part)) return null;

  const toolName = isDynamicToolPart(part)
    ? part.toolName
    : part.type.replace(/^tool-/, '') || 'unknown';

  const state = part.state;
  const isSuccess =
    state === 'output-available' || state === 'approval-responded';
  const isError = state === 'output-error' || state === 'output-denied';
  const isPending = !isSuccess && !isError;

  const toolCall: AgentToolCall = {
    toolCallId,
    toolName,
    input: part.input,
    output: (part as Record<string, unknown>).output,
    state: isError ? 'error' : isSuccess ? 'success' : 'pending',
  };

  return (
    <OrchestratorLogLineInner
      toolCallId={toolCallId}
      isPending={isPending}
      isSuccess={isSuccess}
      isError={isError}
      toolCall={toolCall}
    />
  );
};

const OrchestratorLogLineInner: React.FC<{
  toolCallId: string;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  toolCall: AgentToolCall;
}> = ({toolCallId, isPending, isSuccess, isError, toolCall}) => {
  const showDetails = useShowToolCallDetails();
  const {getActivityLabel} = useToolRenderBehavior();
  const timing = useStoreWithAi((s) => s.ai.toolTimings[toolCallId]);
  const elapsed = useElapsedTime(
    isPending,
    timing?.startedAt,
    timing?.completedAt,
  );

  const inputObj =
    toolCall.input && typeof toolCall.input === 'object'
      ? (toolCall.input as Record<string, unknown>)
      : undefined;
  const reasoning = inputObj?.reasoning as string | undefined;

  const label =
    reasoning ??
    (getActivityLabel ? getActivityLabel(toolCall) : undefined) ??
    (isPending ? 'Thinking...' : toolCall.toolName);

  return (
    <div
      className={cn(
        'grid min-w-0 items-start gap-x-1.5 overflow-hidden py-0.5',
        showDetails
          ? 'grid-cols-[14px_minmax(0,1fr)_auto_auto]'
          : 'grid-cols-[14px_minmax(0,1fr)_auto]',
        !isError && 'text-muted-foreground',
      )}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center">
        {isPending && (
          <Loader2 className="text-muted-foreground/50 h-3 w-3 animate-spin" />
        )}
        {isSuccess && (
          <CircleIcon className="text-muted-foreground/40 h-1.5 w-1.5 fill-current" />
        )}
        {isError && <CircleXIcon className="h-3 w-3" />}
      </span>
      <span
        className={cn(
          'min-w-0 leading-4 break-all whitespace-normal',
          reasoning && 'italic',
        )}
      >
        {label}
      </span>
      {elapsed ? (
        <span className="text-muted-foreground/60 shrink-0 text-[10px]">
          {elapsed}
        </span>
      ) : timing?.startedAt != null && timing?.completedAt != null ? (
        <span className="text-muted-foreground/60 shrink-0 text-[10px]">
          {formatShortDuration(timing.completedAt - timing.startedAt)}
        </span>
      ) : (
        <span />
      )}
      {showDetails && <ToolCallDetailHover toolCall={toolCall} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FlatAgentRenderer — replaces the nested AgentRenderer with a flat timeline
// ---------------------------------------------------------------------------

export const FlatAgentRenderer: React.FC<{
  toolCallId: string;
  agentToolCalls: AgentToolCall[];
  finalOutput?: string;
  isComplete?: boolean;
  parentToolName?: string;
  parentInput?: unknown;
}> = ({
  toolCallId,
  agentToolCalls,
  isComplete,
  parentToolName,
  parentInput,
}) => {
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const agentProgress = useStoreWithAi((s) => s.ai.agentProgress);
  const hoistedRendererNames = useHoistedRenderers();
  const {isPassthroughTool} = useToolRenderBehavior();

  const displayCalls = agentProgress[toolCallId] ?? agentToolCalls;

  const hoistableSet = useMemo(
    () => new Set(hoistedRendererNames),
    [hoistedRendererNames],
  );

  const segments = useMemo(
    () => buildFlatSegments(displayCalls, agentProgress, isPassthroughTool),
    [displayCalls, agentProgress, isPassthroughTool],
  );

  const parentToolCall = useMemo(
    (): AgentToolCall | undefined =>
      parentToolName
        ? {
            toolCallId,
            toolName: parentToolName,
            input: parentInput,
            state: isComplete ? 'success' : 'pending',
          }
        : undefined,
    [toolCallId, parentToolName, parentInput, isComplete],
  );

  const hideParentSummary = !!(
    parentToolCall &&
    isPassthroughTool &&
    isPassthroughTool(parentToolCall)
  );

  return (
    <div className="mt-1 flex w-full min-w-0 flex-col gap-1.5 overflow-hidden text-[0.9em]">
      {parentToolName && !hideParentSummary && (
        <ParentSummaryLine
          toolCallId={toolCallId}
          toolName={parentToolName}
          isComplete={!!isComplete}
          toolCall={parentToolCall}
        />
      )}

      <FlatSegmentList
        segments={segments}
        agentProgress={agentProgress}
        hoistableSet={hoistableSet}
        toolRenderers={toolRenderers}
        isPassthroughTool={isPassthroughTool}
      />
    </div>
  );
};
