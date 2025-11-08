import React from 'react';
import {ToolUIPart} from 'ai';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '../AiSlice';
import {isToolPart} from '../utils';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';

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
export const ToolPartRenderer: React.FC<ToolPartRendererProps> = ({part}) => {
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.toolAdditionalData || {},
  );
  const tools = useStoreWithAi((s) => s.ai.tools);
  const findToolComponent = useStoreWithAi((s) => s.ai.findToolComponent);

  // Check if it's a tool part (including dynamic-tool)
  const isTool =
    isToolPart(part) ||
    (typeof part.type === 'string' && part.type === 'dynamic-tool');
  if (!isTool) return null;

  const toolCallId = (part as ToolUIPart).toolCallId;
  const toolName =
    part.type === 'dynamic-tool'
      ? ((part as any).toolName || 'unknown')
      : part.type.replace(/^tool-/, '') || 'unknown';
  const state = (part as any).state;
  const input = (part as any).input;
  const output =
    state === 'output-available' ? (part as any).output : undefined;
  const errorText =
    state === 'output-error' ? (part as any).errorText : undefined;
  const isCompleted =
    state === 'output-available' || state === 'output-error';
  const additionalData = toolAdditionalData[toolCallId];

  // Check if tool has no execute function, if no, render <ToolComponent> which will addToolResult
  if (
    isCompleted === false &&
    !tools[toolName]?.execute &&
    (state === 'input-streaming' || state === 'input-available')
  ) {
    const ToolComponent = findToolComponent(toolName);
    const props = {
      ...(input as Record<string, unknown>),
      ...({toolCallId, toolName} as Record<string, unknown>),
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
    return (
      <div>
        <ToolCallInfo
          toolName={toolName}
          input={input}
          isCompleted={isCompleted}
          state={state}
        />
        <div data-tool-call-id={toolCallId}>
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
        </div>
      </div>
    );
  }

  return null;
};

