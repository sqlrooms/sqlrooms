import React, {useMemo} from 'react';
import {CircleXIcon, Loader2, CircleDotIcon, CircleIcon} from 'lucide-react';
import {formatShortDuration} from '@sqlrooms/utils';
import {cn, HoverCard, HoverCardContent, HoverCardTrigger} from '@sqlrooms/ui';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '../AiSlice';
import type {AgentToolCall} from '../agents/AgentUtils';
import {useElapsedTime} from '../hooks/useElapsedTime';
import {humanizeToolName, isDynamicToolPart, isToolPart} from '../utils';
import {useHoistedRenderers} from './HoistedRenderersContext';
import {ActivityBox} from './ActivityBox';
import {type HoistableToolCall} from './collectHoistableRenderers';
import {ToolCallErrorBoundary} from './tools/ToolResultErrorBoundary';

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
  const isSuccess = toolCall.state === 'success';
  const isError = toolCall.state === 'error';
  const isPending = toolCall.state === 'pending';

  const inputObj =
    toolCall.input && typeof toolCall.input === 'object'
      ? (toolCall.input as Record<string, unknown>)
      : undefined;
  const reasoning = inputObj?.reasoning as string | undefined;

  const label = reasoning || toolCall.toolName;

  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[14px_minmax(0,1fr)_auto_auto] items-start gap-x-1.5 overflow-hidden py-0.5',
        isError && 'text-red-600 dark:text-red-400',
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
      <span className="min-w-0 leading-4 break-all whitespace-normal">
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
      <ToolCallDetailHover toolCall={toolCall} />
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
  reasoning?: string;
  isComplete: boolean;
  startedAt?: number;
  completedAt?: number;
  toolCall?: AgentToolCall;
}> = ({
  toolCallId,
  toolName,
  reasoning,
  isComplete,
  startedAt,
  completedAt,
  toolCall,
}) => {
  const timing = useStoreWithAi((s) => s.ai.toolTimings[toolCallId]);
  const effectiveStartedAt = timing?.startedAt ?? startedAt;
  const effectiveCompletedAt = timing?.completedAt ?? completedAt;
  const elapsed = useElapsedTime(
    !isComplete,
    effectiveStartedAt,
    effectiveCompletedAt,
  );
  const displayName = humanizeToolName(toolName);

  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[16px_minmax(0,1fr)_auto_auto] items-start gap-x-2 py-1 text-xs',
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {!isComplete ? (
          <Loader2 className="text-muted-foreground/50 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CircleIcon className="text-muted-foreground/30 h-2 w-2 fill-current" />
        )}
      </span>
      <span className="min-w-0 leading-4 break-words">
        <span className="font-medium">{displayName}</span>
        {reasoning && (
          <span className="ml-1.5 font-normal italic">{reasoning}</span>
        )}
      </span>
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
      {toolCall ? <ToolCallDetailHover toolCall={toolCall} /> : <span />}
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
  if (item.state !== 'success') return null;

  return (
    <ToolCallErrorBoundary>
      <ToolComponent
        output={item.output}
        input={item.input}
        toolCallId={item.toolCallId}
        state="output-available"
        errorText={item.errorText}
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

function getReasoning(tc: AgentToolCall): string | undefined {
  const inputObj =
    tc.input && typeof tc.input === 'object'
      ? (tc.input as Record<string, unknown>)
      : undefined;
  return inputObj?.reasoning as string | undefined;
}

// ---------------------------------------------------------------------------
// buildFlatSegments — partition a list of tool calls into segments:
//   consecutive non-agent tools => ToolGroupSegment
//   agent calls => AgentSegment (recursed at render time)
// ---------------------------------------------------------------------------

function buildFlatSegments(
  calls: AgentToolCall[],
  agentProgress: Record<string, AgentToolCall[]>,
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
}> = ({segments, agentProgress, hoistableSet, toolRenderers}) => {
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === 'tool-group') {
          const anyPending = seg.tools.some((t) => t.state === 'pending');

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
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        }

        // Agent segment: render summary line, then recurse into sub-segments
        const {toolCall, nestedCalls} = seg;
        const reasoning = getReasoning(toolCall);
        const isComplete =
          toolCall.state === 'success' || toolCall.state === 'error';

        const childSegments = buildFlatSegments(nestedCalls, agentProgress);

        return (
          <React.Fragment key={toolCall.toolCallId}>
            <ParentSummaryLine
              toolCallId={toolCall.toolCallId}
              toolName={toolCall.toolName}
              reasoning={reasoning}
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

  const inputObj =
    part.input && typeof part.input === 'object'
      ? (part.input as Record<string, unknown>)
      : undefined;
  const reasoning = inputObj?.reasoning as string | undefined;
  const label = reasoning || toolName;

  return (
    <OrchestratorLogLineInner
      toolCallId={toolCallId}
      label={label}
      isPending={isPending}
      isSuccess={isSuccess}
      isError={isError}
    />
  );
};

const OrchestratorLogLineInner: React.FC<{
  toolCallId: string;
  label: string;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}> = ({toolCallId, label, isPending, isSuccess, isError}) => {
  const timing = useStoreWithAi((s) => s.ai.toolTimings[toolCallId]);
  const elapsed = useElapsedTime(
    isPending,
    timing?.startedAt,
    timing?.completedAt,
  );

  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-x-1.5 overflow-hidden py-0.5',
        isError && 'text-red-600 dark:text-red-400',
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
      <span className="min-w-0 leading-4 break-all whitespace-normal">
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

  const displayCalls = agentProgress[toolCallId] ?? agentToolCalls;

  const hoistableSet = useMemo(
    () => new Set(hoistedRendererNames),
    [hoistedRendererNames],
  );

  const segments = useMemo(
    () => buildFlatSegments(displayCalls, agentProgress),
    [displayCalls, agentProgress],
  );

  const parentInputObj =
    parentInput && typeof parentInput === 'object'
      ? (parentInput as Record<string, unknown>)
      : undefined;
  const parentReasoning = parentInputObj?.reasoning as string | undefined;

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

  return (
    <div className="mt-1 flex w-full min-w-0 flex-col gap-1.5 overflow-hidden text-[0.9em]">
      {parentToolName && (
        <ParentSummaryLine
          toolCallId={toolCallId}
          toolName={parentToolName}
          reasoning={parentReasoning}
          isComplete={!!isComplete}
          toolCall={parentToolCall}
        />
      )}

      <FlatSegmentList
        segments={segments}
        agentProgress={agentProgress}
        hoistableSet={hoistableSet}
        toolRenderers={toolRenderers}
      />
    </div>
  );
};
