import React from 'react';
import {ToolCallComponents, ToolCallMessage} from '@openassistant/core';
import {ToolCallErrorBoundary} from './ToolResultErrorBoundary';
import {MessageContainer} from './components/MessageContainer';

type ToolResultProps = {
  toolCallMessage: ToolCallMessage;
  errorMessage?: string;
  toolComponents: ToolCallComponents;
};

function getBorderColor(toolName: string) {
  switch (toolName) {
    case 'query':
      return 'border-gray-500';
    case 'chart':
      return 'border-blue-500';
    case 'answer':
      return 'border-green-500';
    default:
      return 'border-gray-500';
  }
}

export const ToolResult: React.FC<ToolResultProps> = ({
  toolCallMessage,
  errorMessage,
  toolComponents,
}) => {
  const {toolName, args, llmResult, additionalData, text, isCompleted} =
    toolCallMessage;

  // get the component using the toolName
  const Component = toolComponents?.find(
    (component) => component.toolName === toolName,
  )?.component;

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
      borderColor={getBorderColor(toolName)}
      title={toolName}
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
      {Component && isSuccess && isCompleted && Boolean(additionalData) && (
        <ToolCallErrorBoundary>
          {typeof Component === 'function' ? (
            <Component {...(additionalData as Record<string, unknown>)} />
          ) : (
            Component
          )}
        </ToolCallErrorBoundary>
      )}
      {isCompleted && (errorMessage || !isSuccess) && (
        <div className="text-red-500 gap-2 flex flex-col">
          <p className="text-sm font-bold">Oops! Something went wrong...</p>
          <p className="text-xs">{errorMessage}</p>
          <p className="text-xs">{JSON.stringify(llmResult)}</p>
        </div>
      )}
    </MessageContainer>
  );
};
