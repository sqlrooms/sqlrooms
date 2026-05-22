import {Chat} from '@sqlrooms/ai';
import {SkeletonPane} from '@sqlrooms/ui';
import React from 'react';
import {useRoomStore} from '../store';
import {AssistantContextSelector} from './AssistantContextSelector';

interface AssistantChatContainerProps {
  contextDropTarget: {
    id: string;
    canAccept: (data: unknown) => boolean;
    onDrop: (data: unknown) => void;
  };
}

export const AssistantChatContainer: React.FC<AssistantChatContainerProps> = ({
  contextDropTarget,
}) => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);
  const updateProvider = useRoomStore((s) => s.aiSettings.updateProvider);

  return (
    <Chat.Root>
      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Chat.Sessions className="w-full" />
        </div>
        <div className="print-container grow overflow-auto">
          {!currentSessionId ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <p className="text-muted-foreground mt-4">No session selected</p>
            </div>
          ) : isDataAvailable ? (
            <Chat.Messages
              key={currentSessionId}
              hoistedRenderers={['chart']}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <SkeletonPane className="p-4" />
              <p className="text-muted-foreground mt-4">Loading database...</p>
            </div>
          )}
        </div>{' '}
        <Chat.PromptSuggestions>
          <Chat.PromptSuggestions.Item text="What questions can I ask to get insights from my data?" />
          <Chat.PromptSuggestions.Item text="Show me a summary of the data" />
          <Chat.PromptSuggestions.Item text="What are the key trends?" />
          <Chat.PromptSuggestions.Item text="Help me understand the data structure" />
        </Chat.PromptSuggestions>
        <Chat.Composer
          placeholder="What would you like to learn about the data?"
          contextDropTarget={contextDropTarget}
        >
          <Chat.InlineApiKeyInput
            onSaveApiKey={(provider, apiKey) => {
              updateProvider(provider, {apiKey});
            }}
          />
          <AssistantContextSelector />
          <div className="flex items-center justify-end gap-2">
            <Chat.PromptSuggestions.VisibilityToggle />
            <Chat.ModelSelector />
          </div>
        </Chat.Composer>
      </div>
    </Chat.Root>
  );
};
