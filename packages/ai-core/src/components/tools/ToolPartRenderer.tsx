import React from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {
  isDynamicToolPart,
  isToolPart,
  isRecord,
  getToolName,
} from '../../utils';
import {ToolResult} from './ToolResult';
import {ToolCallInfo} from './ToolCallInfo';
import {AgentToolCall} from '../../agents/AgentUtils';
import {UITool, UIToolInvocation} from 'ai';
import type {UIMessagePartSchema} from '@sqlrooms/ai-config';

/**
 * Component that renders agent tool execution progress
 */
const AgentProgressRenderer: React.FC<{
  agentToolCalls: AgentToolCall[];
  finalOutput?: string;
}> = ({agentToolCalls, finalOutput}) => {
  const findToolComponent = useStoreWithAi((s) => s.ai.findToolComponent);

  return (
    <div className="mt-2 px-5 text-[0.9em]">
      <div className="ml-3">
        {agentToolCalls.map((toolCall) => {
          const ToolComponent = findToolComponent(toolCall.toolName);
          const isSuccess = toolCall.state === 'success';
          const isError = toolCall.state === 'error';
          const hasObjectOutput = isRecord(toolCall.output);

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

              {isSuccess && !!ToolComponent && hasObjectOutput ? (
                <div className="mt-1 ml-6">
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
 * Component that renders an individual tool part from a UI message.
 * Handles both tools with execute functions and tools without (dynamic components).
 *
 * @component
 * @param props - Component props
 * @param props.part - The UI message part to render
 * @returns A React component displaying the tool part, or null if not a tool part
 */
export const ToolPartRenderer = ({part}: {part: UIMessagePartSchema}) => {
  const tools = useStoreWithAi((s) => s.ai.tools);
  const toolComponents = useStoreWithAi((s) => s.ai.toolComponents);
  const agentToolCallData = useStoreWithAi((s) => s.ai.agentToolCallData);

  if (!isToolPart(part) && !isDynamicToolPart(part)) return null;

  const {toolCallId, state, input} = part;
  if (!isRecord(input)) return null;

  const toolName = getToolName(part);

  const output = state === 'output-available' ? part.output : undefined;
  const errorText = state === 'output-error' ? part.errorText : undefined;
  const isCompleted = state === 'output-available' || state === 'output-error';

  // render ui tool
  if (
    !tools[toolName]?.execute &&
    (state === 'input-streaming' ||
      state === 'input-available' ||
      state === 'output-available')
  ) {
    const ToolComponent = toolComponents[toolName];
    const props = {
      ...input,
      ...({toolCallId, toolName, isCompleted} as Record<string, unknown>),
    };
    return <div>{!!ToolComponent && <ToolComponent {...props} />}</div>;
  }

  // Otherwise, render <ToolResult>
  if (tools[toolName]?.execute) {
    const isAgentTool = toolName.startsWith('agent-');
    const agentData = agentToolCallData[toolCallId];
    const hasAgentProgress =
      isAgentTool &&
      agentData?.agentToolCalls &&
      agentData.agentToolCalls.length > 0;

    const toolData = {
      toolCallId,
      state: state,
      input: input,
      output: output,
      errorText: errorText,
    } as UIToolInvocation<UITool>;

    return (
      <div>
        <ToolCallInfo toolName={toolName} input={input} state={state} />
        <div data-tool-call-id={toolCallId}>
          {hasAgentProgress ? (
            <AgentProgressRenderer
              agentToolCalls={agentData.agentToolCalls!}
              finalOutput={agentData.finalOutput}
            />
          ) : (
            <ToolResult
              toolName={toolName}
              toolData={toolData}
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
