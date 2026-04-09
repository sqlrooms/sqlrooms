import React, {useMemo} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {InfoIcon} from 'lucide-react';
import {HoverCard, HoverCardContent, HoverCardTrigger} from '@sqlrooms/ui';
import {formatShortDuration} from '@sqlrooms/utils';
import {useStoreWithAi} from '../AiSlice';
import type {AgentToolCall} from '../agents/AgentUtils';
import {useElapsedTime} from '../hooks/useElapsedTime';
import type {ToolRendererRegistry} from '../types';
import {useExcludeFromGrouping} from './ExcludeFromGroupingContext';
import {ExpandableContent} from './ExpandableContent';
import {ReasoningBox, ReasoningTitle} from './ReasoningBox';
import {generateReasoningTitle} from '../utils';
import type {ToolCallSummary} from '../utils';

// ---------------------------------------------------------------------------
// Grouping utility
// ---------------------------------------------------------------------------

function toToolCallSummaries(calls: AgentToolCall[]): ToolCallSummary[] {
  return calls.map((tc) => ({
    toolName: tc.toolName,
    completed: tc.state === 'success' || tc.state === 'error',
    reasoning:
      tc.input && typeof tc.input === 'object'
        ? ((tc.input as Record<string, unknown>).reasoning as
            | string
            | undefined)
        : undefined,
  }));
}

type AgentToolCallGroup = {
  type: 'grouped' | 'standalone';
  calls: AgentToolCall[];
};

function groupAgentToolCalls(
  toolCalls: AgentToolCall[],
  exclude: string[],
  toolRenderers: ToolRendererRegistry = {},
  agentProgress: Record<string, AgentToolCall[]> = {},
): AgentToolCallGroup[] {
  const isStandalone = (tc: AgentToolCall) => {
    const hasNestedCalls =
      (agentProgress[tc.toolCallId]?.length ?? 0) > 0 ||
      (tc.agentToolCalls?.length ?? 0) > 0;
    return (
      tc.toolName.startsWith('agent-') ||
      hasNestedCalls ||
      exclude.includes(tc.toolName) ||
      typeof toolRenderers[tc.toolName] === 'function'
    );
  };

  const groups: AgentToolCallGroup[] = [];
  let currentGroup: AgentToolCall[] = [];

  for (const tc of toolCalls) {
    if (isStandalone(tc)) {
      if (currentGroup.length > 0) {
        groups.push({type: 'grouped', calls: currentGroup});
        currentGroup = [];
      }
      groups.push({type: 'standalone', calls: [tc]});
    } else {
      currentGroup.push(tc);
    }
  }

  if (currentGroup.length > 0) {
    groups.push({type: 'grouped', calls: currentGroup});
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const ToolCallDetailPopup: React.FC<{
  toolCall: {
    toolCallId: string;
    toolName: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    state: 'pending' | 'success' | 'error' | 'approval-requested';
  };
}> = ({toolCall}) => (
  <HoverCard openDelay={0} closeDelay={150}>
    <HoverCardTrigger asChild>
      <span className="ml-1 inline-flex cursor-pointer">
        <InfoIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
      </span>
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
          className={
            toolCall.state === 'success'
              ? 'text-green-600'
              : toolCall.state === 'error'
                ? 'text-red-600'
                : toolCall.state === 'approval-requested'
                  ? 'text-amber-600'
                  : 'text-yellow-600'
          }
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

const StepElapsed: React.FC<{
  startedAt: number;
  completedAt?: number;
}> = ({startedAt, completedAt}) => {
  const isRunning = completedAt == null;
  const elapsedText = useElapsedTime(isRunning, startedAt, completedAt);

  if (!isRunning) {
    return (
      <span className="ml-1 text-[0.85em] text-gray-400">
        {formatShortDuration(completedAt - startedAt)}
      </span>
    );
  }

  return elapsedText ? (
    <span className="ml-1 text-[0.85em] text-gray-400">{elapsedText}</span>
  ) : null;
};

// ---------------------------------------------------------------------------
// Tool call entry – renders a single tool call line + output
// ---------------------------------------------------------------------------

const ToolCallEntry: React.FC<{
  toolCall: AgentToolCall;
  toolRenderers: ToolRendererRegistry;
  /** Hide the tool name / status header (used when the parent ReasoningBox already shows it) */
  hideHeader?: boolean;
}> = ({toolCall, toolRenderers, hideHeader}) => {
  const agentProgress = useStoreWithAi((s) => s.ai.agentProgress);
  const ToolComponent = toolRenderers[toolCall.toolName];
  const isSuccess = toolCall.state === 'success';
  const isError = toolCall.state === 'error';
  const isApprovalRequested = toolCall.state === 'approval-requested';
  const hasComponent = ToolComponent && typeof ToolComponent === 'function';

  const inputObj =
    toolCall.input && typeof toolCall.input === 'object'
      ? (toolCall.input as Record<string, unknown>)
      : undefined;
  const reasoning = inputObj?.reasoning as string | undefined;

  // Resolve nested sub-agent calls
  const nestedCalls =
    agentProgress[toolCall.toolCallId] ?? toolCall.agentToolCalls;

  const hasNestedCalls = nestedCalls != null && nestedCalls.length > 0;
  const isAgent = toolCall.toolName.startsWith('agent-') || hasNestedCalls;

  // For agent output, extract finalOutput
  const agentOutput =
    isAgent && isSuccess
      ? (toolCall.output as {
          agentToolCalls?: AgentToolCall[];
          finalOutput?: string;
        })
      : undefined;

  return (
    <div className={`mb-2 ${isError ? 'text-red-700' : 'text-gray-600'}`}>
      {reasoning && !hideHeader && (
        <div className="mb-1 ml-6 text-xs text-gray-500 italic">
          {reasoning}
        </div>
      )}
      {!hideHeader && (
        <div className="mb-1 flex items-start">
          <span className="mr-2 min-w-4">
            {isSuccess && '✓'}
            {isError && '✗'}
            {isApprovalRequested && '⏳'}
            {toolCall.state === 'pending' && '○'}
          </span>
          <div className="flex-1">
            <span className="font-medium">{toolCall.toolName}</span>
            {toolCall.startedAt != null && (
              <StepElapsed
                startedAt={toolCall.startedAt}
                completedAt={toolCall.completedAt}
              />
            )}
            <ToolCallDetailPopup toolCall={toolCall} />
            {isError && toolCall.errorText && (
              <div className="mt-0.5 text-[0.9em] text-red-700">
                Error: {toolCall.errorText}
              </div>
            )}
          </div>
        </div>
      )}
      {hideHeader && isError && toolCall.errorText && (
        <div className="mb-1 text-[0.9em] text-red-700">
          Error: {toolCall.errorText}
        </div>
      )}

      {/* Approval state */}
      {isApprovalRequested && hasComponent ? (
        <div className="mt-1 ml-6">
          <ToolComponent
            output={undefined}
            input={toolCall.input}
            toolCallId={toolCall.toolCallId}
            state="approval-requested"
            approvalId={toolCall.approvalId}
          />
        </div>
      ) : null}

      {/* Sub-agent: recursive AgentRenderer */}
      {isAgent && nestedCalls && nestedCalls.length > 0 ? (
        <div className="ml-6">
          <AgentRenderer
            toolCallId={toolCall.toolCallId}
            agentToolCalls={nestedCalls}
            finalOutput={agentOutput?.finalOutput}
            isComplete={isSuccess || isError}
          />
        </div>
      ) : null}

      {/* Tool with registered renderer */}
      {!isAgent && isSuccess && hasComponent ? (
        <div className="mt-1 ml-6">
          <ToolComponent
            output={toolCall.output}
            input={toolCall.input}
            toolCallId={toolCall.toolCallId}
            state="output-available"
            errorText={toolCall.errorText}
          />
        </div>
      ) : null}

      {/* Error output fallback */}
      {isError && toolCall.output != null ? (
        <div className="mt-1 ml-6">
          <pre className="max-h-32 overflow-auto rounded bg-red-50 p-2 font-mono text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
            {typeof toolCall.output === 'string'
              ? toolCall.output
              : JSON.stringify(toolCall.output, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AgentRenderer – groups tool calls and wraps every group in a ReasoningBox.
// Standalone items (sub-agents + excluded tools) get their own ReasoningBox
// that is expanded by default, enabling nested reasoning boxes.
// ---------------------------------------------------------------------------

export const AgentRenderer: React.FC<{
  toolCallId: string;
  agentToolCalls: AgentToolCall[];
  finalOutput?: string;
  reasoning?: string;
  /** When true the agent tool call itself has finished (success or error). */
  isComplete?: boolean;
}> = ({toolCallId, agentToolCalls, finalOutput, reasoning, isComplete}) => {
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const agentProgress = useStoreWithAi((s) => s.ai.agentProgress);
  const liveProgress = agentProgress[toolCallId];
  const exclude = useExcludeFromGrouping();

  const displayCalls = liveProgress ?? agentToolCalls;

  const allAgentCallsCompleted = useMemo(
    () =>
      displayCalls.every(
        (tc) => tc.state === 'success' || tc.state === 'error',
      ),
    [displayCalls],
  );

  const groups = useMemo(
    () =>
      groupAgentToolCalls(displayCalls, exclude, toolRenderers, agentProgress),
    [displayCalls, exclude, toolRenderers, agentProgress],
  );

  return (
    <div className="mt-2 text-[0.9em]">
      {reasoning ? (
        <div className="prose prose-sm dark:prose-invert mb-2 max-w-none min-w-0 overflow-hidden text-sm text-gray-500 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:wrap-break-word [&_pre]:whitespace-pre-wrap [&_pre_code]:wrap-break-word [&_pre_code]:whitespace-pre-wrap">
          <Markdown remarkPlugins={[remarkGfm]}>{reasoning}</Markdown>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        {groups.map((group, idx) => {
          const isLastGroup = idx === groups.length - 1;

          if (group.type === 'standalone') {
            const tc = group.calls[0]!;
            const isAgent = tc.toolName.startsWith('agent-');
            const hasRenderer =
              toolRenderers[tc.toolName] &&
              typeof toolRenderers[tc.toolName] === 'function';
            const isCompleted = tc.state === 'success' || tc.state === 'error';
            const titleDesc = generateReasoningTitle(
              toToolCallSummaries(group.calls),
              !isCompleted,
            );
            const showSpinner = !isComplete && (!isCompleted || isLastGroup);

            return (
              <ReasoningBox
                key={tc.toolCallId}
                title={<ReasoningTitle descriptor={titleDesc} />}
                defaultOpen={isAgent || hasRenderer}
                isRunning={showSpinner}
                startedAt={tc.startedAt}
                completedAt={tc.completedAt}
              >
                <ToolCallEntry
                  toolCall={tc}
                  toolRenderers={toolRenderers}
                  hideHeader
                />
              </ReasoningBox>
            );
          }

          const allCompleted = group.calls.every(
            (tc) => tc.state === 'success' || tc.state === 'error',
          );
          const hasMoreAfter = idx < groups.length - 1;
          const toolsStillRunning =
            !allCompleted || (hasMoreAfter && !allAgentCallsCompleted);
          const showSpinner = !isComplete && (toolsStillRunning || isLastGroup);

          // Compute timing directly from the tool calls' own timestamps
          // (toolTimings store is not populated for agent sub-tool calls)
          let groupStartedAt: number | undefined;
          let groupCompletedAt: number | undefined;
          for (const tc of group.calls) {
            if (tc.startedAt != null) {
              if (groupStartedAt == null || tc.startedAt < groupStartedAt)
                groupStartedAt = tc.startedAt;
            }
            if (tc.completedAt != null) {
              if (groupCompletedAt == null || tc.completedAt > groupCompletedAt)
                groupCompletedAt = tc.completedAt;
            }
          }

          const groupTitleDesc = generateReasoningTitle(
            toToolCallSummaries(group.calls),
            toolsStillRunning,
          );

          return (
            <ReasoningBox
              key={`group-${idx}`}
              collapsedTitle={<ReasoningTitle descriptor={groupTitleDesc} />}
              isRunning={showSpinner}
              startedAt={groupStartedAt}
              completedAt={groupCompletedAt}
            >
              {group.calls.map((tc) => (
                <ToolCallEntry
                  key={tc.toolCallId}
                  toolCall={tc}
                  toolRenderers={toolRenderers}
                />
              ))}
            </ReasoningBox>
          );
        })}
      </div>

      {finalOutput && (
        <div className="mt-3 pt-2">
          <ExpandableContent>
            <div className="prose prose-sm dark:prose-invert max-w-none min-w-0 overflow-hidden text-gray-600 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:wrap-break-word [&_pre]:whitespace-pre-wrap [&_pre_code]:wrap-break-word [&_pre_code]:whitespace-pre-wrap">
              <Markdown remarkPlugins={[remarkGfm]}>{finalOutput}</Markdown>
            </div>
          </ExpandableContent>
        </div>
      )}
    </div>
  );
};
