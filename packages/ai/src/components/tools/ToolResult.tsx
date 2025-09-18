import {Button, useDisclosure} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {MessageContainer} from '../MessageContainer';
import {ToolCallErrorBoundary} from './ToolResultErrorBoundary';
import {ToolErrorMessage} from './ToolErrorMessage';

// Tool invocation type that can handle both migrated and AI SDK formats
type ToolInvocationData = {
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
    | 'output-available'
    | 'output-error';
  result?: any;
  output?: any;
  errorText?: string;
  [key: string]: any;
};

type ToolResultProps = {
  toolInvocation: ToolInvocationData;
  additionalData: unknown;
  isCompleted: boolean;
  errorMessage?: string;
};

export const ToolResult: React.FC<ToolResultProps> = ({
  toolInvocation,
  additionalData,
  isCompleted,
  errorMessage,
}) => {
  const {isOpen: showDetails, onToggle: toggleShowDetails} =
    useDisclosure(false);

  const toolName = toolInvocation.toolName || toolInvocation.name || 'unknown';
  const args = toolInvocation.args || toolInvocation.input || {};
  const state = toolInvocation.state || 'call';
  const llmResult =
    state === 'result' || state === 'output-available'
      ? toolInvocation.result || toolInvocation.output
      : null;

  // show reason text before tool call complete
  const text = args.reasoning || '';

  const ToolComponent = useStoreWithAi((state) =>
    state.ai.findToolComponent(toolName),
  );

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
      {isCompleted && (errorMessage || !isSuccess) && (
        <ToolErrorMessage
          error={errorMessage ?? 'Tool call failed'}
          details={toolInvocation}
          title="Tool call error"
          triggerLabel="Tool call failed"
          editorHeightPx={300}
        />
      )}
    </MessageContainer>
  );
};
