import {AiSettingsPanel, Chat, useStoreWithAiSettings} from '@sqlrooms/ai';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SkeletonPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {useRoomStore} from '../store';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);

  const settingsPanelOpen = useDisclosure();
  const updateProvider = useStoreWithAiSettings(
    (s) => s.aiSettings.updateProvider,
  );

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      <Chat>
        <div className="mb-4 flex items-center justify-between gap-2">
          <Chat.Sessions className="w-full" />
          {currentSessionId && (
            <Dialog
              open={settingsPanelOpen.isOpen}
              onOpenChange={(open) => {
                if (open) {
                  settingsPanelOpen.onOpen();
                } else {
                  settingsPanelOpen.onClose();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center justify-center transition-colors hover:bg-accent"
                  title="Configuration"
                  size="sm"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="flex h-[80vh] w-[90vw] max-w-3xl flex-col overflow-hidden">
                <DialogHeader>
                  <DialogTitle>AI Assistant Settings</DialogTitle>
                </DialogHeader>
                <Tabs
                  defaultValue="providers"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <TabsList className="grid w-full flex-shrink-0 grid-cols-3">
                    <TabsTrigger value="providers">Providers</TabsTrigger>
                    <TabsTrigger value="models">Models</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="providers"
                    className="flex-1 overflow-y-auto"
                  >
                    <AiSettingsPanel.ProvidersSettings />
                  </TabsContent>
                  <TabsContent
                    value="models"
                    className="flex-1 overflow-y-auto"
                  >
                    <AiSettingsPanel.ModelsSettings />
                  </TabsContent>
                  <TabsContent
                    value="parameters"
                    className="flex-1 overflow-y-auto"
                  >
                    <AiSettingsPanel.ModelParametersSettings />
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="print-container flex-grow overflow-auto">
          {isDataAvailable ? (
            <Chat.Messages
              key={currentSessionId} // will prevent scrolling to bottom after changing current session
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <SkeletonPane className="p-4" />
              <p className="mt-4 text-muted-foreground">Loading database...</p>
            </div>
          )}
        </div>

        <Chat.PromptSuggestions>
          <Chat.PromptSuggestions.Item text="What questions can I ask to get insights from my data?" />
          <Chat.PromptSuggestions.Item text="Show me a summary of the data" />
          <Chat.PromptSuggestions.Item text="What are the key trends?" />
          <Chat.PromptSuggestions.Item text="Help me understand the data structure" />
        </Chat.PromptSuggestions>

        <Chat.Composer placeholder="What would you like to learn about the data?">
          <Chat.InlineApiKeyInput
            onSaveApiKey={(provider, apiKey) => {
              updateProvider(provider, {apiKey});
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <Chat.PromptSuggestions.VisibilityToggle />
            <Chat.ModelSelector />
          </div>
        </Chat.Composer>
      </Chat>
    </div>
  );
};
