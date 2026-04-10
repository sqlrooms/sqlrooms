import React from 'react';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {useStoreWithAi} from '../AiSlice';
import type {AgentToolCall} from '../types';
import {useToolTimingRecorder} from '../hooks/useToolTimingRecorder';
import {isDynamicToolPart, isToolPart} from '../utils';
import {FlatAgentRenderer} from './FlatAgentRenderer';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';

/**
 * Decides whether to show live agent progress or the final tool result.
 * Uses FlatAgentRenderer for a flat, user-friendly timeline. Falls back to agentToolCalls in the
 * tool output for backward compatibility with older persisted messages.
 */
const AgentProgressSection: React.FC<{
  toolCallId: string;
  toolName: string;
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
}> = ({toolCallId, toolName, output, input, state, errorText}) => {
  const storeProgress = useStoreWithAi((s) => s.ai.agentProgress[toolCallId]);

  const agentOutput = output as {
    agentToolCalls?: AgentToolCall[];
    finalOutput?: string;
  };

  const finalOutput = agentOutput?.finalOutput;

  const displayCalls =
    storeProgress ??
    (agentOutput?.agentToolCalls?.length ? agentOutput.agentToolCalls : null);

  if (displayCalls && displayCalls.length > 0) {
    const isComplete =
      state === 'output-available' ||
      state === 'output-error' ||
      state === 'output-denied';
    return (
      <FlatAgentRenderer
        toolCallId={toolCallId}
        agentToolCalls={displayCalls}
        finalOutput={state === 'output-available' ? finalOutput : undefined}
        isComplete={isComplete}
        parentToolName={toolName}
        parentInput={input}
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
  hideToolCallInfo,
}: {
  part: UIMessagePart;
  toolCallId: string;
  hideToolCallInfo?: boolean;
}) => {
  const tools = useStoreWithAi((s) => s.ai.tools);
  const toolRenderers = useStoreWithAi((s) => s.ai.toolRenderers);

  const isComplete =
    isToolPart(part) || isDynamicToolPart(part)
      ? part.state === 'output-available' ||
        part.state === 'output-error' ||
        part.state === 'output-denied'
      : false;
  useToolTimingRecorder(toolCallId, isComplete);

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
        {!isAgentTool && !hideToolCallInfo && (
          <ToolCallInfo
            toolName={toolName}
            input={input}
            state={state}
            stableKey={toolCallId}
          />
        )}
        <div data-tool-call-id={toolCallId}>
          {isAgentTool ? (
            <AgentProgressSection
              toolCallId={toolCallId}
              toolName={toolName}
              output={output}
              input={input}
              state={state}
              errorText={errorText}
            />
          ) : hideToolCallInfo ? (
            ToolComponent &&
            typeof ToolComponent === 'function' &&
            state === 'output-available' ? (
              <ToolComponent
                output={output}
                input={input}
                toolCallId={toolCallId}
                state={state}
                errorText={errorText}
              />
            ) : null
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
