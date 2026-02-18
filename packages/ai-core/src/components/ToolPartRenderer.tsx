import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '../AiSlice';
import {isDynamicToolPart, isToolPart} from '../utils';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';

/**
 * Component that renders agent tool execution progress
 */
const AgentProgressRenderer: React.FC<{
  agentToolCalls: Array<{
    toolCallId: string;
    toolName: string;
    output?: unknown;
    errorText?: string;
    state: 'pending' | 'success' | 'error';
  }>;
  finalOutput?: string;
  reasoning?: string;
}> = ({agentToolCalls, finalOutput, reasoning}) => {
  const findToolComponent = useStoreWithAi((s) => s.ai.findToolComponent);

  return (
    <div className="mt-2 px-5 text-[0.9em]">
      {reasoning ? (
        <div className="prose prose-sm dark:prose-invert mb-2 max-w-none text-sm text-gray-500">
          <Markdown remarkPlugins={[remarkGfm]}>{reasoning}</Markdown>
        </div>
      ) : null}
      <div className="ml-3">
        {agentToolCalls.map((toolCall) => {
          const ToolComponent = findToolComponent(toolCall.toolName);
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
                  {isError && toolCall.errorText && (
                    <div className="mt-0.5 text-[0.9em] text-red-700">
                      Error: {toolCall.errorText}
                    </div>
                  )}
                </div>
              </div>

              {isSuccess && hasComponent && hasObjectOutput ? (
                <div className="ml-6 mt-1">
                  <ToolComponent
                    {...(toolCall.output as Record<string, unknown>)}
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
  toolAdditionalData = {},
}: {
  part: UIMessagePart;
  toolCallId: string;
  toolAdditionalData?: Record<string, unknown>;
}) => {
  const tools = useStoreWithAi((s) => s.ai.tools);

  if (!isToolPart(part) && !isDynamicToolPart(part)) return null;

  const {type, state, input} = part;
  const toolName =
    type === 'dynamic-tool'
      ? part.toolName || 'unknown'
      : type.replace(/^tool-/, '') || 'unknown';

  const output = state === 'output-available' ? part.output : undefined;
  const errorText = state === 'output-error' ? part.errorText : undefined;
  const isCompleted = state === 'output-available' || state === 'output-error';
  const additionalData = toolAdditionalData[toolCallId];

  if (
    !tools[toolName]?.execute &&
    (state === 'input-streaming' ||
      state === 'input-available' ||
      state === 'output-available')
  ) {
    const ToolComponent = tools[toolName]?.component as React.ComponentType;
    const props = {
      ...(input as Record<string, unknown>),
      ...({toolCallId, toolName, isCompleted} as Record<string, unknown>),
    };
    return (
      <div>
        {ToolComponent && typeof ToolComponent === 'function' && (
          <ToolComponent {...props} />
        )}
      </div>
    );
  }

  // Otherwise, render <ToolResult>
  if (tools[toolName]?.execute) {
    const isAgentTool = toolName.startsWith('agent-');
    const agentData = additionalData as {
      agentToolCalls?: Array<{
        toolCallId: string;
        toolName: string;
        output?: unknown;
        errorText?: string;
        state: 'pending' | 'success' | 'error';
      }>;
      finalOutput?: string;
    };
    const hasAgentProgress =
      isAgentTool &&
      agentData?.agentToolCalls &&
      agentData.agentToolCalls.length > 0;
    const reasoning =
      input instanceof Object && 'reasoning' in input
        ? (input.reasoning as string)
        : undefined;

    return (
      <div>
        <ToolCallInfo
          toolName={toolName}
          input={input}
          isCompleted={isCompleted}
          state={state}
        />
        <div data-tool-call-id={toolCallId}>
          {hasAgentProgress ? (
            <AgentProgressRenderer
              agentToolCalls={agentData.agentToolCalls!}
              finalOutput={agentData.finalOutput}
              reasoning={reasoning}
            />
          ) : (
            <ToolResult
              toolCallId={toolCallId}
              toolData={{
                toolCallId,
                name: toolName,
                state: state,
                args: input,
                result: output,
                errorText,
              }}
              additionalData={additionalData}
              isCompleted={isCompleted}
              errorMessage={state === 'output-error' ? errorText : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
};
