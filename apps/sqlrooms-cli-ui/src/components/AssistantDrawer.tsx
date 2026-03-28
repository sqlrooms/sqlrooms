import {
  AiConnectDialog,
  AiProviderConnectButton,
  AiSettingsPanel,
  Chat,
} from '@sqlrooms/ai';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  SkeletonPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {Settings, XIcon} from 'lucide-react';
import React from 'react';
import {runtimeConfig, useRoomStore} from '../store';

export const AssistantDrawer: React.FC<{
  children?: React.ReactNode;
}> = ({children}) => {
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
  const isAssistantOpen = useRoomStore((state) => state.isAssistantOpen);
  const setAssistantOpen = useRoomStore((state) => state.setAssistantOpen);

  return (
    <Drawer
      direction="right"
      open={isAssistantOpen}
      onOpenChange={setAssistantOpen}
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent
        className="border-none bg-transparent p-4 outline-none"
        style={{
          width: 500,
          maxWidth: '50%',
        }}
        data-vaul-drawer-direction="right"
        overlayClassName="bg-transparent"
      >
        <div className="border-border bg-background relative mx-auto flex h-full w-full flex-col gap-0 overflow-hidden rounded-md border">
          <DrawerHeader>
            <DrawerTitle>Assistant</DrawerTitle>
            <DrawerClose asChild className="absolute top-2 right-2">
              <Button variant="ghost" size="xs">
                <XIcon className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <Chat.Root>
            <AiConnectDialog apiBaseUrl={runtimeConfig.apiBaseUrl || ''} />
            <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-4">
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
                          <TabsTrigger value="parameters">
                            Parameters
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="connect"
                          className="flex-1 overflow-y-auto"
                        >
                          <AiSettingsPanel.ConnectSettings
                            apiBaseUrl={runtimeConfig.apiBaseUrl || ''}
                          />
                        </TabsContent>
                        <TabsContent
                          value="providers"
                          className="flex-1 overflow-y-auto"
                        >
                          <AiSettingsPanel.ProvidersSettings
                            apiBaseUrl={runtimeConfig.apiBaseUrl || ''}
                          />
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
                {!currentSessionId ? (
                  <div className="flex h-full w-full flex-col items-center justify-center">
                    <p className="text-muted-foreground mt-4">
                      No session selected
                    </p>
                  </div>
                ) : isDataAvailable ? (
                  <Chat.Messages key={currentSessionId} />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center">
                    <SkeletonPane className="p-4" />
                    <p className="text-muted-foreground mt-4">
                      Loading database...
                    </p>
                  </div>
                )}
              </div>{' '}
              <Chat.PromptSuggestions>
                <Chat.PromptSuggestions.Item text="What questions can I ask to get insights from my data?" />
                <Chat.PromptSuggestions.Item text="Show me a summary of the data" />
                <Chat.PromptSuggestions.Item text="What are the key trends?" />
                <Chat.PromptSuggestions.Item text="Help me understand the data structure" />
              </Chat.PromptSuggestions>
              {currentProviderHasCredentials ? (
                <Chat.Composer placeholder="What would you like to learn about the data?">
                  <div className="flex items-center justify-end gap-2">
                    <Chat.PromptSuggestions.VisibilityToggle />
                    <Chat.ModelSelector />
                  </div>
                </Chat.Composer>
              ) : (
                <div className="border-border bg-muted/30 mt-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Connect a provider</p>
                      <p className="text-muted-foreground text-sm">
                        The assistant needs credentials for{' '}
                        <span className="font-mono">{currentProviderId}</span>{' '}
                        before it can chat.
                      </p>
                    </div>
                    <AiProviderConnectButton
                      providerId={currentProviderId || undefined}
                      apiBaseUrl={runtimeConfig.apiBaseUrl || ''}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Chat.PromptSuggestions.VisibilityToggle />
                    <Chat.ModelSelector />
                  </div>
                </div>
              )}
            </div>
          </Chat.Root>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
