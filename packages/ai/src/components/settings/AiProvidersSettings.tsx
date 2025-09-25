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
  DialogFooter,
  useDisclosure,
  useToast,
} from '@sqlrooms/ui';
import {
  Cone,
  Settings,
  Plus,
  Server,
  Key,
  Trash2,
  CirclePlus,
} from 'lucide-react';
import {useStoreWithAiSettings} from '../../AiSettingsSlice';

export const AiProvidersSettings: FC = () => {
  const {toast} = useToast();
  const updateProvider = useStoreWithAiSettings(
    (state) => state.updateProvider,
  );
  const addProvider = useStoreWithAiSettings((state) => state.addProvider);
  const removeProvider = useStoreWithAiSettings(
    (state) => state.removeProvider,
  );
  const providers = useStoreWithAiSettings(
    (state) => state.config.aiSettings.providers,
  );
  const modelProviders = React.useMemo(() => {
    const result: Record<string, {apiKey: string; baseUrl: string}> = {};
    Object.entries(providers).forEach(([key, provider]) => {
      result[key] = {
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
  const [newProviderKey, setNewProviderKey] = useState('');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');

  // Dialog state for delete confirmation
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const [providerToDelete, setProviderToDelete] = useState<{
    key: string;
  } | null>(null);

  const handleAddProvider = () => {
    if (newProviderKey) {
      // Check if provider already exists
      if (providers[newProviderKey]) {
        toast({
          title: 'Provider already exists',
          description: `A provider with the key "${newProviderKey}" already exists. Please choose a different key.`,
          variant: 'destructive',
        });
        return;
      }

      addProvider(newProviderKey, newProviderBaseUrl, newProviderApiKey);
      setNewProviderKey('');
      setNewProviderApiKey('');
      setNewProviderBaseUrl('');
      onClose();

      toast({
        title: 'Provider added successfully',
        description: `Provider "${newProviderKey}" has been added.`,
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

  const handleDeleteProvider = (providerKey: string) => {
    setProviderToDelete({key: providerKey});
    onDeleteOpen();
  };

  const confirmDeleteProvider = () => {
    if (providerToDelete) {
      removeProvider(providerToDelete.key);
      onDeleteClose();
      setProviderToDelete(null);

      toast({
        title: 'Provider deleted successfully',
        description: `Provider "${providerToDelete.key}" and its associated models have been removed.`,
      });
    }
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
        Providers
      </label>

      {/* Existing Providers */}
      <div className="space-y-1">
        {Object.entries(modelProviders).map(([providerKey, provider]) => {
          const isExpanded = expandedProviders.has(providerKey);

          return (
            <div key={providerKey} className="space-y-0 rounded-lg p-0">
              {/* First row: Provider name, API key input, delete button, and cogwheel button */}
              <div className="flex items-center gap-3">
                <Label className="w-20 flex-shrink-0 text-sm">
                  {providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}
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
                  onClick={() => handleDeleteProvider(providerKey)}
                  className="h-6 h-8 w-6 w-8 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
                  <div className="w-16 flex-shrink-0" />{' '}
                  {/* Spacer to align with delete and cogwheel buttons above */}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Provider */}
      <div className="flex w-full p-2">
        <Button onClick={onOpen} variant="secondary" size="sm">
          <CirclePlus className="h-3 w-3" />
          Add
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
              <Label htmlFor="new-provider-key" className="w-20 text-sm">
                Key
              </Label>
              <div className="relative flex-1">
                <Cone className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="new-provider-key"
                  value={newProviderKey}
                  onChange={(e) => setNewProviderKey(e.target.value)}
                  placeholder="e.g., anthropic"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="new-provider-api-key" className="w-20 text-sm">
                API Key
              </Label>
              <div className="relative flex-1">
                <Key className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="new-provider-api-key"
                  type="password"
                  value={newProviderApiKey}
                  onChange={(e) => setNewProviderApiKey(e.target.value)}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => (open ? onDeleteOpen() : onDeleteClose())}
      >
        <DialogContent className="border-0 p-5">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-destructive flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4" /> Delete Provider
            </DialogTitle>
            <DialogDescription className="text-xs">
              This action cannot be undone. This will permanently delete the
              provider and all its associated models.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <p className="text-sm">
              Are you sure you want to delete the provider{' '}
              <strong>&ldquo;{providerToDelete?.key}&rdquo;</strong>?
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              All models associated with this provider will also be removed.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeleteProvider}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
