import {Chat} from '@sqlrooms/ai';
import {
  AiConnectDialog,
  AiProviderConnectButton,
  AiProviderStatusList,
} from '@sqlrooms/ai-connect';
import {AiSettingsPanel} from '@sqlrooms/ai-settings';
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
  const currentProviderId = useRoomStore(
    (s) =>
      s.ai.getCurrentSession()?.modelProvider ||
      s.aiSettings.config.defaultProvider,
  );
  const currentProviderHasCredentials = useRoomStore((s) => {
    const providerId =
      s.ai.getCurrentSession()?.modelProvider ||
      s.aiSettings.config.defaultProvider;
    if (!providerId) return false;
    return Boolean(
      s.aiSettings.config.providers[providerId]?.status?.hasCredentials,
    );
  });
  const isDataAvailable = useRoomStore((state) => state.room.initialized);

  const settingsPanelOpen = useDisclosure();

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      <Chat>
        <AiConnectDialog />
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
                  className="hover:bg-accent flex items-center justify-center transition-colors"
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
                  defaultValue="connect"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <TabsList className="grid w-full shrink-0 grid-cols-4">
                    <TabsTrigger value="connect">Connect</TabsTrigger>
                    <TabsTrigger value="providers">Providers</TabsTrigger>
                    <TabsTrigger value="models">Models</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="connect"
                    className="flex-1 space-y-3 overflow-y-auto"
                  >
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Browser demo mode stores provider credentials in local
                      browser storage. That is convenient for examples, but not
                      how you should persist production secrets.
                    </div>
                    <AiProviderStatusList />
                  </TabsContent>
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

        <div className="print-container grow overflow-auto">
          {isDataAvailable ? (
            <Chat.Messages
              key={currentSessionId} // will prevent scrolling to bottom after changing current session
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <SkeletonPane className="p-4" />
              <p className="text-muted-foreground mt-4">Loading database...</p>
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
          {currentProviderHasCredentials ? (
            <div className="flex items-center justify-end gap-2">
              <Chat.PromptSuggestions.VisibilityToggle />
              <Chat.ModelSelector />
            </div>
          ) : (
            <div className="border-border bg-muted/30 mt-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Connect a provider</p>
                  <p className="text-muted-foreground text-sm">
                    The browser demo needs credentials for{' '}
                    <span className="font-mono">{currentProviderId}</span>{' '}
                    before it can chat.
                  </p>
                </div>
                <AiProviderConnectButton
                  providerId={currentProviderId || undefined}
                />
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Safe flows work fully in-browser. Experimental login methods are
                intentionally labeled and may need provider-specific
                adjustments.
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Chat.PromptSuggestions.VisibilityToggle />
                <Chat.ModelSelector />
              </div>
            </div>
          )}
        </Chat.Composer>
      </Chat>
    </div>
  );
};
