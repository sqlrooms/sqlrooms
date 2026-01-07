import React from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {MessageContainer} from '../MessageContainer';
import {ToolCallErrorBoundary} from './ToolResultErrorBoundary';
import {ToolErrorMessage} from './ToolErrorMessage';

// Tool invocation type that can handle both migrated and AI SDK formats
type ToolData = {
  toolCallId: string;
  toolName?: string;
  name?: string;
  args?: any;
  input?: any;
  state?:
    | 'call'
    | 'result'
    | 'partial-call'
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
    | 'output-denied';
  result?: any;
  output?: any;
  errorText?: string;
  [key: string]: any;
};

export const ToolResult: React.FC<ToolData> = ({
  toolData,
  additionalData,
  isCompleted,
  errorMessage,
}) => {
  const toolName = toolData.toolName || toolData.name || 'unknown';
  const args = toolData.args || toolData.input || {};
  const state = toolData.state || 'call';
  const llmResult =
    state === 'result' || state === 'output-available'
      ? toolData.result || toolData.output
      : null;

  // show reason text before tool call complete
  const text = args.reasoning || '';

  // Access tool component directly from tools registry to avoid lint error
  // about creating components during render
  const tools = useStoreWithAi((state) => state.ai.tools);
  const ToolComponent = tools[toolName]?.component as React.ComponentType;

  // check if args has a property called 'reason'
  const reason = args.reasoning as string;

  // check if llmResult is an object and has a success property
  const isSuccess =
    typeof llmResult === 'object' &&
    llmResult !== null &&
    'success' in llmResult &&
    llmResult.success === true;

  return !isCompleted ? (
    <div className="text-sm text-gray-500">{text}</div>
  ) : (
    <MessageContainer
      isSuccess={isSuccess}
      type={toolName}
      content={{
        toolName,
        args,
        llmResult,
        additionalData,
        isCompleted,
      }}
    >
      <div className="text-sm text-gray-500">
        {reason && <span>{reason}</span>}
        {isCompleted && (errorMessage || !isSuccess) && (
          <ToolErrorMessage
            error={errorMessage ?? 'Tool call failed'}
            details={toolData}
            title="Tool call error"
            triggerLabel="Tool call failed"
            editorHeightPx={300}
          />
        )}
      </div>
      {ToolComponent && isSuccess && isCompleted && (
        <ToolCallErrorBoundary>
          {typeof ToolComponent === 'function' ? (
            <ToolComponent
              {...(llmResult as Record<string, unknown>)}
              {...(additionalData as Record<string, unknown>)}
            />
          ) : (
            ToolComponent
          )}
        </ToolCallErrorBoundary>
      )}
    </MessageContainer>
  );
};
