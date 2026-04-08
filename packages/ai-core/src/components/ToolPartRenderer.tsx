import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {InfoIcon} from 'lucide-react';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {HoverCard, HoverCardContent, HoverCardTrigger} from '@sqlrooms/ui';
import {formatShortDuration} from '@sqlrooms/utils';
import {useStoreWithAi} from '../AiSlice';
import type {AgentToolCall} from '../agents/AgentUtils';
import {useElapsedTime} from '../hooks/useElapsedTime';
import type {ToolRendererRegistry} from '../types';
import {isDynamicToolPart, isToolPart} from '../utils';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';

const ToolCallDetailPopup: React.FC<{
  toolCall: {
    toolCallId: string;
    toolName: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    state: 'pending' | 'success' | 'error' | 'approval-requested';
  };
}> = ({toolCall}) => {
  return (
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
};

/**
 * Renders a live-updating elapsed-time badge for a single agent sub-step.
 */
const AgentStepElapsed: React.FC<{
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

/**
 * Renders a single tool call entry with:
 * 1. Reasoning (if present in input)
 * 2. Status line: ✓/✗/○/⏳ toolName elapsed (i)
 * 3. Inline output (custom renderer or formatted JSON)
 *
 * Used for both orchestrator-level and sub-agent tool calls.
 */
const AgentToolCallEntry: React.FC<{
  toolCall: AgentToolCall;
  toolRenderers: ToolRendererRegistry;
  nestedCalls?: AgentToolCall[];
  showOutput?: boolean;
}> = ({toolCall, toolRenderers, nestedCalls, showOutput = false}) => {
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

  const hasNonAgentOutput =
    isSuccess &&
    toolCall.output != null &&
    (typeof toolCall.output !== 'object' ||
      !('agentToolCalls' in (toolCall.output as Record<string, unknown>)));

  return (
    <div className={`mb-2 ${isError ? 'text-red-700' : 'text-gray-600'}`}>
      {reasoning && (
        <div className="mb-1 ml-6 text-xs text-gray-500 italic">
          {reasoning}
        </div>
      )}
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
            <AgentStepElapsed
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

      {nestedCalls && nestedCalls.length > 0 ? (
        <div className="ml-6">
          <AgentToolCallList
            toolCalls={nestedCalls}
            toolRenderers={toolRenderers}
            showOutput={showOutput}
          />
        </div>
      ) : null}

      {(showOutput || isError) && isSuccess && hasComponent ? (
        <div className="mt-1 ml-6">
          <ToolComponent
            output={toolCall.output}
            input={toolCall.input}
            toolCallId={toolCall.toolCallId}
            state="output-available"
            errorText={toolCall.errorText}
          />
        </div>
      ) : (showOutput && hasNonAgentOutput) ||
        (isError && toolCall.output != null) ? (
        <div className="mt-1 ml-6">
          <pre
            className={`max-h-32 overflow-auto rounded p-2 font-mono text-[10px] ${
              isError
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            {typeof toolCall.output === 'string'
              ? toolCall.output
              : JSON.stringify(toolCall.output, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Recursively renders a list of agent tool calls.
 * When a tool call has nested `agentToolCalls` (i.e. it invoked a sub-agent),
 * those are rendered as an indented sub-list.
 * During live streaming, also checks `agentProgress` for in-flight nested calls.
 */
const AgentToolCallList: React.FC<{
  toolCalls: AgentToolCall[];
  toolRenderers: ToolRendererRegistry;
  showOutput?: boolean;
}> = ({toolCalls, toolRenderers, showOutput}) => {
  const agentProgress = useStoreWithAi((s) => s.ai.agentProgress);

  return (
    <>
      {toolCalls.map((toolCall) => {
        const nestedCalls =
          agentProgress[toolCall.toolCallId] ?? toolCall.agentToolCalls;

        return (
          <AgentToolCallEntry
            key={toolCall.toolCallId}
            toolCall={toolCall}
            toolRenderers={toolRenderers}
            nestedCalls={nestedCalls}
            showOutput={showOutput}
          />
        );
      })}
    </>
  );
};

/**
 * Component that renders agent tool execution progress.
 * Reads live progress from the store while the agent is running,
 * then falls back to the final output once the tool completes.
 */
const AgentProgressRenderer: React.FC<{
  toolCallId: string;
  agentToolCalls: AgentToolCall[];
  finalOutput?: string;
  reasoning?: string;
}> = ({toolCallId, agentToolCalls, finalOutput, reasoning}) => {
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);
  const liveProgress = useStoreWithAi((s) => s.ai.agentProgress[toolCallId]);

  const displayCalls = liveProgress ?? agentToolCalls;

  return (
    <div className="mt-2 px-5 text-[0.9em]">
      {reasoning ? (
        <div className="prose prose-sm dark:prose-invert mb-2 max-w-none text-sm text-gray-500">
          <Markdown remarkPlugins={[remarkGfm]}>{reasoning}</Markdown>
        </div>
      ) : null}
      <div className="ml-3">
        <AgentToolCallList
          toolCalls={displayCalls}
          toolRenderers={toolRenderers}
        />
      </div>
      {finalOutput && (
        <div className="mt-3 pt-2">
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600">
            <Markdown remarkPlugins={[remarkGfm]}>{finalOutput}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Decides whether to show live agent progress or the final tool result.
 * Reads agent tool call data primarily from the store's agentProgress
 * (which persists after completion). Falls back to agentToolCalls in the
 * tool output for backward compatibility with older persisted messages.
 */
const AgentProgressSection: React.FC<{
  toolCallId: string;
  output: unknown;
  input: unknown;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-denied';
  errorText?: string;
}> = ({toolCallId, output, input, state, errorText}) => {
  const storeProgress = useStoreWithAi((s) => s.ai.agentProgress[toolCallId]);

  const agentOutput = output as {
    agentToolCalls?: AgentToolCall[];
    finalOutput?: string;
  };

  const finalOutput = agentOutput?.finalOutput;

  const reasoning =
    input instanceof Object && 'reasoning' in input
      ? (input.reasoning as string)
      : undefined;

  // Prefer store-based progress (covers both live streaming and completed
  // agents). Fall back to agentToolCalls embedded in tool output for
  // backward compat with older persisted messages.
  const displayCalls =
    storeProgress ??
    (agentOutput?.agentToolCalls?.length ? agentOutput.agentToolCalls : null);

  if (displayCalls && displayCalls.length > 0) {
    return (
      <AgentProgressRenderer
        toolCallId={toolCallId}
        agentToolCalls={displayCalls}
        finalOutput={state === 'output-available' ? finalOutput : undefined}
        reasoning={reasoning}
      />
    );
  }

  return (
    <ToolResult
      toolCallId={toolCallId}
      toolName="agent"
      output={output}
      input={input}
      state={state}
      errorText={state === 'output-error' ? errorText : undefined}
    />
  );
};

/**
 * Component that renders an individual tool part from a UI message.
 * Handles both tools with execute functions and tools without (dynamic components).
 *
 * @component
 * @param props - Component props
 * @param props.part - The UI message part to render
 * @returns A React component displaying the tool part, or null if not a tool part
 */
export const ToolPartRenderer = ({
  part,
  toolCallId,
}: {
  part: UIMessagePart;
  toolCallId: string;
}) => {
  const tools = useStoreWithAi((s) => s.ai.tools);
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);

  if (!isToolPart(part) && !isDynamicToolPart(part)) return null;

  const {type, state, input} = part;
  const toolName = isDynamicToolPart(part)
    ? part.toolName
    : type.replace(/^tool-/, '') || 'unknown';

  const output = state === 'output-available' ? part.output : undefined;
  const errorText = state === 'output-error' ? part.errorText : undefined;
  const isApprovalState =
    state === 'approval-requested' ||
    state === 'approval-responded' ||
    state === 'output-denied';
  const approvalId =
    isApprovalState && 'approval' in part ? part.approval?.id : undefined;

  const hasExecute = !!tools[toolName]?.execute;
  // Look up directly from the registry object (stable reference) to avoid
  // the react-hooks/static-components lint rule flagging a function call.
  const ToolComponent = toolRenderers[toolName];

  if (isApprovalState && !ToolComponent) {
    console.error(
      `Tool "${toolName}" is requesting approval but has no renderer configured.`,
    );
    return null;
  }

  // Render the ToolComponent directly for:
  // - Tools without execute (legacy no-execute pattern)
  // - Tools in approval states (needsApproval pattern)
  if (
    (!hasExecute &&
      (state === 'input-streaming' ||
        state === 'input-available' ||
        state === 'output-available')) ||
    (isApprovalState && ToolComponent)
  ) {
    return (
      <div>
        {ToolComponent && typeof ToolComponent === 'function' && (
          <ToolComponent
            output={output}
            input={input}
            toolCallId={toolCallId}
            state={state}
            errorText={errorText}
            approvalId={approvalId}
          />
        )}
      </div>
    );
  }

  // Otherwise, render <ToolResult>
  if (hasExecute) {
    const isAgentTool = toolName.startsWith('agent-');

    return (
      <div>
        <ToolCallInfo
          toolName={toolName}
          input={input}
          state={state}
          stableKey={toolCallId}
          hideElapsed={isAgentTool}
        />
        <div data-tool-call-id={toolCallId}>
          {isAgentTool ? (
            <AgentProgressSection
              toolCallId={toolCallId}
              output={output}
              input={input}
              state={state}
              errorText={errorText}
            />
          ) : (
            <ToolResult
              toolCallId={toolCallId}
              toolName={toolName}
              output={output}
              input={input}
              state={state}
              errorText={state === 'output-error' ? errorText : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
};
