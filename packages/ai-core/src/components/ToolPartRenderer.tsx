import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {InfoIcon} from 'lucide-react';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {HoverCard, HoverCardContent, HoverCardTrigger} from '@sqlrooms/ui';
import type {AgentToolCall} from '../agents/AgentUtils';
import {useStoreWithAi} from '../AiSlice';
import {isDynamicToolPart, isToolPart} from '../utils';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';
import {formatShortDuration} from '@sqlrooms/utils';

const ToolCallDetailPopup: React.FC<{
  toolCall: AgentToolCall;
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
                  : 'text-yellow-600'
            }
          >
            {toolCall.state}
          </span>
        </div>
        {toolCall.output != null && (
          <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-gray-50 p-1.5 font-mono text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            {typeof toolCall.output === 'string'
              ? toolCall.output
              : JSON.stringify(toolCall.output, null, 2)}
          </pre>
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
        {displayCalls.map((toolCall) => {
          const ToolComponent = toolRenderers[toolCall.toolName];
          const isSuccess = toolCall.state === 'success';
          const isError = toolCall.state === 'error';
          const hasComponent =
            ToolComponent && typeof ToolComponent === 'function';
          const hasObjectOutput =
            toolCall.output &&
            typeof toolCall.output === 'object' &&
            toolCall.output !== null;

          return (
            <div
              key={toolCall.toolCallId}
              className={`mb-2 ${isError ? 'text-red-700' : 'text-gray-600'}`}
            >
              <div className="mb-1 flex items-start">
                <span className="mr-2 min-w-[16px]">
                  {isSuccess && '✓'}
                  {isError && '✗'}
                  {toolCall.state === 'pending' && '○'}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{toolCall.toolName}</span>
                  {toolCall.startedAt != null &&
                    (() => {
                      const elapsed =
                        (toolCall.completedAt ?? Date.now()) -
                        toolCall.startedAt;
                      const showAlways = toolCall.completedAt != null;
                      return showAlways || elapsed >= 1000 ? (
                        <span className="ml-1 text-[0.85em] text-gray-400">
                          {formatShortDuration(elapsed)}
                        </span>
                      ) : null;
                    })()}
                  <ToolCallDetailPopup toolCall={toolCall} />
                  {isError && toolCall.errorText && (
                    <div className="mt-0.5 text-[0.9em] text-red-700">
                      Error: {toolCall.errorText}
                    </div>
                  )}
                </div>
              </div>

              {isSuccess && hasComponent && hasObjectOutput ? (
                <div className="mt-1 ml-6">
                  <ToolComponent
                    output={toolCall.output}
                    input={undefined}
                    toolCallId={toolCall.toolCallId}
                    state="output-available"
                    errorText={toolCall.errorText}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
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
 * While the agent is running, live progress is read from the store.
 * After completion, the final output (including agentToolCalls) is used.
 */
const AgentProgressSection: React.FC<{
  toolCallId: string;
  output: unknown;
  input: unknown;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error';
  errorText?: string;
}> = ({toolCallId, output, input, state, errorText}) => {
  const liveProgress = useStoreWithAi((s) => s.ai.agentProgress[toolCallId]);

  const agentOutput = output as {
    agentToolCalls?: AgentToolCall[];
    finalOutput?: string;
  };

  const hasFinishedAgentProgress =
    agentOutput?.agentToolCalls && agentOutput.agentToolCalls.length > 0;

  const reasoning =
    input instanceof Object && 'reasoning' in input
      ? (input.reasoning as string)
      : undefined;

  if (liveProgress && liveProgress.length > 0) {
    return (
      <AgentProgressRenderer
        toolCallId={toolCallId}
        agentToolCalls={[]}
        reasoning={reasoning}
      />
    );
  }

  if (hasFinishedAgentProgress) {
    return (
      <AgentProgressRenderer
        toolCallId={toolCallId}
        agentToolCalls={agentOutput.agentToolCalls!}
        finalOutput={agentOutput.finalOutput}
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
  const toolName =
    type === 'dynamic-tool'
      ? part.toolName || 'unknown'
      : type.replace(/^tool-/, '') || 'unknown';

  const output = state === 'output-available' ? part.output : undefined;
  const errorText = state === 'output-error' ? part.errorText : undefined;

  const hasExecute = !!tools[toolName]?.execute;
  // Look up directly from the registry object (stable reference) to avoid
  // the react-hooks/static-components lint rule flagging a function call.
  const ToolComponent = toolRenderers[toolName];

  if (
    !hasExecute &&
    (state === 'input-streaming' ||
      state === 'input-available' ||
      state === 'output-available')
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
