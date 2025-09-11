import React, {FC, useState} from 'react';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  useDisclosure,
  useToast,
} from '@sqlrooms/ui';
import {Cone, Settings, Plus, Server, Key} from 'lucide-react';
import {useStoreWithAiModelConfig} from '../../AiConfigSlice';

export const ProvidersConfig: FC = () => {
  const {toast} = useToast();
  const updateProvider = useStoreWithAiModelConfig(
    (state) => state.updateProvider,
  );
  const addProvider = useStoreWithAiModelConfig((state) => state.addProvider);
  const providers = useStoreWithAiModelConfig(
    (state) => state.config.aiModelConfig.models,
  );
  const modelProviders = React.useMemo(() => {
    const result: Record<
      string,
      {name: string; apiKey: string; baseUrl: string}
    > = {};
    Object.entries(providers).forEach(([key, provider]) => {
      result[key] = {
        name: provider.name,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
      };
    });
    return result;
  }, [providers]);

  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );

  // Dialog state for adding a new provider
  const {isOpen, onOpen, onClose} = useDisclosure();
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderKey, setNewProviderKey] = useState('');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');

  const handleAddProvider = () => {
    if (newProviderName) {
      const providerKey = newProviderName.toLowerCase().replace(/\s+/g, '-');

      // Check if provider already exists
      if (providers[providerKey]) {
        toast({
          title: 'Provider already exists',
          description: `A provider with the name "${newProviderName}" already exists. Please choose a different name.`,
          variant: 'destructive',
        });
        return;
      }

      addProvider(
        providerKey,
        newProviderName,
        newProviderBaseUrl,
        newProviderKey,
      );
      setNewProviderName('');
      setNewProviderKey('');
      setNewProviderBaseUrl('');
      onClose();

      toast({
        title: 'Provider added successfully',
        description: `Provider "${newProviderName}" has been added.`,
      });
    }
  };

  const handleUpdateProvider = (
    providerKey: string,
    field: 'apiKey' | 'baseUrl',
    value: string,
  ) => {
    updateProvider(providerKey, {[field]: value});
  };

  const toggleProviderExpanded = (providerKey: string) => {
    setExpandedProviders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(providerKey)) {
        newSet.delete(providerKey);
      } else {
        newSet.add(providerKey);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-md flex items-center gap-2 pb-6 font-medium">
        <Cone className="h-4 w-4" />
        Model Providers
      </label>

      {/* Existing Providers */}
      <div className="space-y-1">
        {Object.entries(modelProviders).map(([providerKey, provider]) => {
          const isExpanded = expandedProviders.has(providerKey);

          return (
            <div key={providerKey} className="space-y-0 rounded-lg p-0">
              {/* First row: Provider name, API key input, and cogwheel button */}
              <div className="flex items-center gap-3">
                <Label className="w-20 flex-shrink-0 text-sm">
                  {provider.name.charAt(0).toUpperCase() +
                    provider.name.slice(1)}
                </Label>
                <Input
                  id={`${providerKey}-apiKey`}
                  type="password"
                  value={provider.apiKey}
                  onChange={(e) =>
                    handleUpdateProvider(providerKey, 'apiKey', e.target.value)
                  }
                  placeholder="Enter API key"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleProviderExpanded(providerKey)}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {/* Second row: baseUrl input (toggleable) */}
              {isExpanded && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-20 flex-shrink-0" />{' '}
                  {/* Spacer to align with provider name above */}
                  <div className="flex flex-1 items-center gap-3">
                    <Label
                      htmlFor={`${providerKey}-baseUrl`}
                      className="text-muted-foreground flex-shrink-0 text-xs"
                    >
                      baseUrl:
                    </Label>
                    <Input
                      id={`${providerKey}-baseUrl`}
                      type="url"
                      value={provider.baseUrl}
                      onChange={(e) =>
                        handleUpdateProvider(
                          providerKey,
                          'baseUrl',
                          e.target.value,
                        )
                      }
                      placeholder="Enter base URL"
                      className="flex-1"
                    />
                  </div>
                  <div className="w-8 flex-shrink-0" />{' '}
                  {/* Spacer to align with cogwheel above */}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Provider */}
      <div className="flex w-full justify-end">
        <Button onClick={onOpen} variant="secondary">
          Add Provider
        </Button>
      </div>

      {/* Add New Provider Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => (open ? onOpen() : onClose())}
      >
        <DialogTrigger asChild>
          {/* handled via onOpen button above */}
        </DialogTrigger>
        <DialogContent className="border-0 p-5">
          <DialogHeader className="mb-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cone className="h-4 w-4" /> Add New Provider
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure a new model provider with API credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label htmlFor="new-provider-name" className="w-20 text-sm">
                Name
              </Label>
              <div className="relative flex-1">
                <Cone className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="new-provider-name"
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="e.g., Anthropic"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="new-provider-key" className="w-20 text-sm">
                API Key
              </Label>
              <div className="relative flex-1">
                <Key className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="new-provider-key"
                  type="password"
                  value={newProviderKey}
                  onChange={(e) => setNewProviderKey(e.target.value)}
                  placeholder="Enter API key"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="new-provider-url" className="w-20 text-sm">
                baseUrl
              </Label>
              <div className="relative flex-1">
                <Server className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="new-provider-url"
                  type="url"
                  value={newProviderBaseUrl}
                  onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                  placeholder="Enter base URL"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleAddProvider}>
                <Plus className="mr-2 h-4 w-4" /> Add Provider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
