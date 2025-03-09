import {ToolCallMessage} from '@openassistant/core';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {Button, useDisclosure} from '@sqlrooms/ui';
import {InfoIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithAi} from '../../AiSlice';
import {MessageContainer} from '../MessageContainer';
import {ToolCallErrorBoundary} from './ToolResultErrorBoundary';

type ToolResultProps = {
  toolCallMessage: ToolCallMessage;
  errorMessage?: string;
};

export const ToolResult: React.FC<ToolResultProps> = ({
  toolCallMessage,
  errorMessage,
}) => {
  const {isOpen: showDetails, onToggle: toggleShowDetails} =
    useDisclosure(false);
  const {toolName, args, llmResult, additionalData, text, isCompleted} =
    toolCallMessage;

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
      {ToolComponent && isSuccess && isCompleted && Boolean(additionalData) && (
        <ToolCallErrorBoundary>
          {typeof ToolComponent === 'function' ? (
            <ToolComponent {...(additionalData as Record<string, unknown>)} />
          ) : (
            ToolComponent
          )}
        </ToolCallErrorBoundary>
      )}
      {isCompleted && (errorMessage || !isSuccess) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-red-500">Tool call failed</p>
          <p className="text-xs">{errorMessage}</p>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => toggleShowDetails()}
            className="w-fit"
          >
            <InfoIcon className="h-4 w-4" />
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
          {showDetails && (
            <div className="h-[300px] w-full overflow-hidden rounded-md border">
              <JsonMonacoEditor
                value={toolCallMessage}
                readOnly={true}
                options={{
                  lineNumbers: false,
                  minimap: {enabled: false},
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            </div>
          )}
        </div>
      )}
    </MessageContainer>
  );
};
