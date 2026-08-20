import {AiSettingsPanel, Chat} from '@sqlrooms/ai';
import {
  ChatSuggestionsItem,
  ChatSuggestionsRoot,
  ChatSuggestionsVisibilityToggle,
  usePromptSuggestions,
} from '@sqlrooms/ai-core';
import {
  Button,
  ScrollableRow,
  SkeletonPane,
  cn,
  useDisclosure,
} from '@sqlrooms/ui';
import {Lightbulb, Settings} from 'lucide-react';
import {useRoomStore} from '../store';
import type {FC} from 'react';

const SUGGESTIONS = [
  'What questions can I ask to get insights from my data?',
  'Show me a summary of the data',
  'What are the key trends?',
  'Help me understand the data structure',
];

/**
 * A horizontal, scrollable carousel of suggestion chips, built directly from
 * the suggestions primitives (`ChatSuggestionsRoot`/`ChatSuggestionsItem`)
 * rather than the `Chat.PromptSuggestions` recipe.
 *
 * This is intentional, not an oversight: the default recipe renders a
 * full-width vertical list, so a horizontal layout can no longer be had by
 * configuring the recipe. This example exists to keep the horizontal shape
 * demonstrated and tested somewhere in the repository — proof that the
 * primitives impose no layout of their own. Do not "consistency-fix" this
 * back to the vertical recipe; that would delete the only place the
 * horizontal layout is exercised.
 */
const HorizontalPromptSuggestions: FC = () => (
  <ChatSuggestionsRoot asChild>
    <ScrollableRow
      className="w-full py-1"
      scrollClassName="flex gap-2 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SUGGESTIONS.map((text) => (
        <ChatSuggestionsItem
          key={text}
          text={text}
          submit
          title={text}
          className={cn(
            'w-56 shrink-0 rounded-md border px-3 py-2 text-left text-xs',
            'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-border transition-colors',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <span className="line-clamp-2">{text}</span>
        </ChatSuggestionsItem>
      ))}
    </ScrollableRow>
  </ChatSuggestionsRoot>
);

/**
 * A minimal toggle button for the horizontal carousel above, styled locally
 * since the primitive itself carries no appearance.
 */
const HorizontalPromptSuggestionsVisibilityToggle: FC = () => {
  const suggestions = usePromptSuggestions();
  return (
    <ChatSuggestionsVisibilityToggle
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
        suggestions.visible
          ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-label={
        suggestions.visible
          ? 'Hide prompt suggestions'
          : 'Show prompt suggestions'
      }
      title={
        suggestions.visible
          ? 'Hide prompt suggestions'
          : 'Show prompt suggestions'
      }
    >
      <Lightbulb className="h-4 w-4" />
    </ChatSuggestionsVisibilityToggle>
  );
};

export const MainView: FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);

  const settingsPanelOpen = useDisclosure();
  const updateProvider = useRoomStore((s) => s.aiSettings.updateProvider);

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      <Chat>
        <div className="relative mb-4">
          <Chat.Sessions className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
          <Button
            variant="outline"
            className="hover:bg-accent absolute top-0 right-0 flex h-8 w-8 items-center justify-center transition-colors"
            onClick={settingsPanelOpen.onToggle}
            title="Configuration"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {settingsPanelOpen.isOpen ? (
          <div className="grow overflow-auto">
            <AiSettingsPanel disclosure={settingsPanelOpen}>
              <AiSettingsPanel.ProvidersSettings />
              <AiSettingsPanel.ModelsSettings />
              <AiSettingsPanel.ModelParametersSettings />
            </AiSettingsPanel>
          </div>
        ) : (
          <>
            <div className="grow overflow-auto">
              {isDataAvailable ? (
                <Chat.Messages
                  key={currentSessionId} // will prevent scrolling to bottom after changing current session
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <SkeletonPane className="p-4" />
                  <p className="text-muted-foreground mt-4">
                    Loading database...
                  </p>
                </div>
              )}
            </div>

            <HorizontalPromptSuggestions />

            <Chat.Composer placeholder="What would you like to learn about the data?">
              <Chat.InlineApiKeyInput
                onSaveApiKey={(provider, apiKey) => {
                  updateProvider(provider, {apiKey});
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <HorizontalPromptSuggestionsVisibilityToggle />
                <Chat.ModelSelector />
              </div>
            </Chat.Composer>
          </>
        )}
      </Chat>
    </div>
  );
};
