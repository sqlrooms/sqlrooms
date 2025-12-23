import React from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {MessageContainer} from '../MessageContainer';
import {ToolCallErrorBoundary} from './ToolResultErrorBoundary';
import {ToolErrorMessage} from './ToolErrorMessage';
import {UITool, UIToolInvocation} from 'ai';
import {isRecord} from '../../utils';

type ToolData = UIToolInvocation<UITool>;

export const ToolResult = ({
  toolName,
  toolData,
  isCompleted,
  errorMessage,
}: {
  toolName: string;
  toolData: ToolData;
  isCompleted: boolean;
  errorMessage: string | undefined;
}) => {
  const toolComponents = useStoreWithAi((state) => state.ai.toolComponents);

  const args = toolData.input || {};
  const llmResult = toolData.output;

  if (!isRecord(args) || !isRecord(llmResult)) {
    return null;
  }
  const ToolComponent = toolComponents[toolName];

  const text = 'reasoning' in args ? `${args.reasoning}` : '';
  const isSuccess = 'success' in llmResult && llmResult.success === true;

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
        isCompleted,
      }}
    >
      <div className="text-sm text-gray-500">
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
            <ToolComponent {...llmResult} {...args} />
          ) : (
            ToolComponent
          )}
        </ToolCallErrorBoundary>
      )}
    </MessageContainer>
  );
};
