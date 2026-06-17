import {
  AiProviderStatusList,
  AiQuickLoginButton,
  AiSettingsPanel,
  resolveLoginTargetsFromProviders,
} from '@sqlrooms/ai';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import React from 'react';
import {useRoomStore} from '../store';

interface AssistantSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'connect' | 'providers' | 'models' | 'parameters';
}

export const AssistantSettingsDialog: React.FC<
  AssistantSettingsDialogProps
> = ({isOpen, onOpenChange, initialTab = 'connect'}) => {
  const providers = useRoomStore((s) => s.aiSettings.config.providers);
  const loginTargets = useRoomStore((s) => s.aiQuickLogin.loginTargets);
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const visibleLoginTargets = React.useMemo(
    () => resolveLoginTargetsFromProviders(providers, loginTargets),
    [providers, loginTargets],
  );

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 h-6 w-6 shrink-0 focus-visible:ring-offset-0 focus-visible:ring-inset"
          title="AI Assistant Settings"
          aria-label="AI Assistant Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[80vh] w-[90vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>AI Assistant Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-4">
            <TabsTrigger value="connect">Connect</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
          </TabsList>
          <TabsContent value="connect" className="flex-1 overflow-y-auto pt-4">
            <div className="space-y-4">
              {visibleLoginTargets.length > 0 && (
                <div className="flex items-center justify-end">
                  <AiQuickLoginButton
                    targetId={visibleLoginTargets[0]?.id}
                    variant="secondary"
                    size="sm"
                  />
                </div>
              )}
              <AiProviderStatusList showBuiltinTemplates={false} />
            </div>
          </TabsContent>
          <TabsContent
            value="providers"
            className="flex-1 overflow-y-auto pt-4"
          >
            <AiSettingsPanel.ProvidersSettings
              showTitle={false}
              showBuiltinTemplates={false}
            />
          </TabsContent>
          <TabsContent value="models" className="flex-1 overflow-y-auto pt-4">
            <AiSettingsPanel.ModelsSettings showTitle={false} />
          </TabsContent>
          <TabsContent
            value="parameters"
            className="flex-1 overflow-y-auto pt-4"
          >
            <AiSettingsPanel.ModelParametersSettings showTitle={false} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
