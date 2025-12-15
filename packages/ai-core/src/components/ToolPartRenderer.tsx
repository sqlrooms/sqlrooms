import React from 'react';
import {ToolUIPart} from 'ai';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '../AiSlice';
import {isToolPart} from '../utils';
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
}> = ({agentToolCalls, finalOutput}) => {
  const findToolComponent = useStoreWithAi((s) => s.ai.findToolComponent);

  return (
    <div className="mt-2 px-5 text-[0.9em]">
      <div className="ml-3">
        {agentToolCalls.map((toolCall, index) => {
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
          <div className="text-gray-600">{finalOutput}</div>
        </div>
      )}
    </div>
  );
};

/**
 * Props for the ToolPartRenderer component
 */
type ToolPartRendererProps = {
  part: UIMessagePart;
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
export const ToolPartRenderer = ({part}: {part: any}) => {
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.toolAdditionalData || {},
  );
  const tools = useStoreWithAi((s) => s.ai.tools);

  // Check if it's a tool part (including dynamic-tool)
  const isTool =
    isToolPart(part) ||
    (typeof part.type === 'string' && part.type === 'dynamic-tool');
  if (!isTool) return null;

  const toolCallId = (part as ToolUIPart).toolCallId;
  const toolName =
    part.type === 'dynamic-tool'
      ? part.toolName || 'unknown'
      : part.type.replace(/^tool-/, '') || 'unknown';
  const state = part.state;
  const input = part.input;
  const output =
    state === 'output-available' ? part.output : undefined;
  const errorText =
    state === 'output-error' ? part.errorText : undefined;
  const isCompleted = state === 'output-available' || state === 'output-error';
  const additionalData = toolAdditionalData[toolCallId];

  // Check if tool has no execute function, if no, render <ToolComponent> which will addToolResult
  if (
    !tools[toolName]?.execute &&
    (state === 'input-streaming' ||
      state === 'input-available' ||
      state === 'output-available')
  ) {
    // Access tool component directly from tools registry to avoid lint error
    // about creating components during render
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
    // Check if this is an agent tool (name starts with "agent-")
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
            // Render agent progress
            <AgentProgressRenderer
              agentToolCalls={agentData.agentToolCalls!}
              finalOutput={agentData.finalOutput}
            />
          ) : (
            // Render regular tool result
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
