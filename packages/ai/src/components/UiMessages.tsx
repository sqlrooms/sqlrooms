import React from 'react';
import {useStoreWithAi} from '../AiSlice';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ToolResult} from './tools/ToolResult';

export const UiMessages: React.FC = () => {
  const messages = useStoreWithAi((s) => s.ai.getCurrentSession()?.uiMessages);
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.toolAdditionalData || {},
  );

  if (!messages || messages.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      {messages.map((message) => {
        const isUser = message.role === 'user';
        if (isUser) {
          const userText = message.parts
            .filter((p) => p.type === 'text')
            .map((p) => (p as {text: string}).text)
            .join('');
          return (
            <div
              key={message.id}
              className="group flex w-full flex-col gap-2 pb-2 text-sm"
            >
              <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
                <div className="bg-muted flex w-full items-center gap-2 rounded-md border p-2 text-sm">
                  <div className="flex-1">{userText}</div>
                </div>
              </div>
            </div>
          );
        }

        // assistant message
        return (
          <div
            key={message.id}
            className="group flex w-full flex-col gap-2 pb-2 text-sm"
          >
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <AnalysisAnswer
                    key={index}
                    content={(part as {text: string}).text}
                    isAnswer={index === (message.parts?.length || 0) - 1}
                  />
                );
              }
              if (part.type === 'reasoning') {
                const text = (part as {text: string}).text;
                return (
                  <div key={index} className="text-muted-foreground text-xs">
                    {text}
                  </div>
                );
              }
              if (part.type.startsWith('tool-')) {
                const toolCallId = (part as any).toolCallId as string;
                const toolName = part.type.replace(/^tool-/, '') || 'unknown';
                const state = (part as any).state as string;
                const input = (part as any).input;
                const output = (part as any).output;
                const errorText = (part as any).errorText as string | undefined;
                const isCompleted =
                  state === 'output-available' || state === 'output-error';
                const additionalData = toolAdditionalData[toolCallId];

                return (
                  <ToolResult
                    key={toolCallId}
                    toolInvocation={{
                      toolCallId,
                      name: toolName,
                      state: state as any,
                      args: input,
                      result: output,
                      errorText,
                    }}
                    additionalData={additionalData}
                    isCompleted={isCompleted}
                    errorMessage={
                      state === 'output-error' ? errorText : undefined
                    }
                  />
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
};
