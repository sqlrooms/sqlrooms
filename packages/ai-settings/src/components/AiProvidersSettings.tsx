import React, {FC, useMemo, useState} from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  useDisclosure,
} from '@sqlrooms/ui';
import {CirclePlus, Cone, Key, Server, Settings, Trash2} from 'lucide-react';
import {useStoreWithAiSettings} from '../AiSettingsSlice';

export interface AiProvidersSettingsProps {
  apiBaseUrl?: string;
  showTitle?: boolean;
}

export const AiProvidersSettings: FC<AiProvidersSettingsProps> = ({
  apiBaseUrl,
  showTitle = true,
}) => {
  const updateProvider = useStoreWithAiSettings(
    (state) => state.aiSettings.updateProvider,
  );
  const addProvider = useStoreWithAiSettings(
    (state) => state.aiSettings.addProvider,
  );
  const removeProvider = useStoreWithAiSettings(
    (state) => state.aiSettings.removeProvider,
  );
  const saveToServer = useStoreWithAiSettings(
    (state) => state.aiSettings.saveToServer,
  );
  const providers = useStoreWithAiSettings(
    (state) => state.aiSettings.config.providers,
  );

  const providerEntries = useMemo(() => Object.entries(providers), [providers]);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );
  const {isOpen, onOpen, onClose} = useDisclosure();
  const [newProviderKey, setNewProviderKey] = useState('');
  const [newProviderTitle, setNewProviderTitle] = useState('');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);

  const toggleProviderExpanded = (providerKey: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerKey)) {
        next.delete(providerKey);
      } else {
        next.add(providerKey);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const ok = await saveToServer(apiBaseUrl || '');
    if (ok) {
      toast.success('AI settings saved');
    }
  };

  const handleAddProvider = () => {
    const providerKey = newProviderKey.trim();
    if (!providerKey) return;
    if (providers[providerKey]) {
      toast.error('Provider already exists', {
        description: `A provider with the key "${providerKey}" already exists.`,
      });
      return;
    }
    addProvider(
      providerKey,
      newProviderBaseUrl.trim(),
      newProviderTitle.trim() || providerKey,
    );
    if (newProviderApiKey.trim()) {
      updateProvider(providerKey, {apiKey: newProviderApiKey.trim()});
    }
    setNewProviderKey('');
    setNewProviderTitle('');
    setNewProviderApiKey('');
    setNewProviderBaseUrl('');
    onClose();
    toast.success('Provider added');
  };

  const handleDeleteProvider = () => {
    if (!providerToDelete) return;
    removeProvider(providerToDelete);
    toast.success('Provider deleted');
    setProviderToDelete(null);
    onDeleteClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {showTitle ? (
          <label className="text-md flex items-center gap-2 font-medium">
            <Cone className="h-4 w-4" />
            Providers
          </label>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} size="sm">
            Save
          </Button>
          <Button onClick={onOpen} variant="secondary" size="sm">
            <CirclePlus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {providerEntries.map(([providerKey, provider]) => {
          const isExpanded = expandedProviders.has(providerKey);
          return (
            <div
              key={providerKey}
              className="border-border rounded-lg border p-3"
            >
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(8rem,10rem)_minmax(14rem,1fr)_minmax(14rem,1fr)_2rem_2rem]">
                <Label className="pb-2 text-sm font-medium whitespace-nowrap">
                  {provider.title || providerKey}
                </Label>
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor={`${providerKey}-api-key`}
                    className="text-muted-foreground text-xs"
                  >
                    API key
                  </Label>
                  <Input
                    id={`${providerKey}-api-key`}
                    type="password"
                    value={provider.apiKey || ''}
                    onChange={(e) =>
                      updateProvider(providerKey, {apiKey: e.target.value})
                    }
                    placeholder="Enter API key"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor={`${providerKey}-base-url`}
                    className="text-muted-foreground text-xs"
                  >
                    Base URL
                  </Label>
                  <Input
                    id={`${providerKey}-base-url`}
                    value={provider.baseUrl}
                    onChange={(e) =>
                      updateProvider(providerKey, {baseUrl: e.target.value})
                    }
                    placeholder="Provider base URL"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setProviderToDelete(providerKey);
                    onDeleteOpen();
                  }}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleProviderExpanded(providerKey)}
                  className="h-8 w-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-3 sm:pl-40">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Title</Label>
                      <Input
                        value={provider.title || ''}
                        onChange={(e) =>
                          updateProvider(providerKey, {title: e.target.value})
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Kind</Label>
                      <Input
                        value={provider.kind || ''}
                        onChange={(e) =>
                          updateProvider(providerKey, {kind: e.target.value})
                        }
                      />
                    </div>
                  </div>

                  {provider.experimental && (
                    <Badge variant="secondary">Experimental</Badge>
                  )}

                  <div className="space-y-1">
                    <Label>Default auth method</Label>
                    <Select
                      value={provider.defaultAuthMethod}
                      onValueChange={(value) =>
                        updateProvider(providerKey, {
                          defaultAuthMethod: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a default auth method" />
                      </SelectTrigger>
                      <SelectContent>
                        {(provider.authMethods || []).map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Auth methods</Label>
                    <div className="space-y-2">
                      {(provider.authMethods || []).map((method) => (
                        <div
                          key={method.id}
                          className="bg-muted/40 rounded-md border p-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {method.label}
                            </span>
                            <Badge variant="outline">{method.type}</Badge>
                            {method.experimental && (
                              <Badge variant="secondary">Experimental</Badge>
                            )}
                          </div>
                          {method.description && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {method.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => (open ? onOpen() : onClose())}
      >
        <DialogContent className="border-0 p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              Add provider
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure a model provider and optional API credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-provider-key">Key</Label>
              <Input
                id="new-provider-key"
                value={newProviderKey}
                onChange={(e) => setNewProviderKey(e.target.value)}
                placeholder="e.g. openrouter"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-provider-title">Title</Label>
              <Input
                id="new-provider-title"
                value={newProviderTitle}
                onChange={(e) => setNewProviderTitle(e.target.value)}
                placeholder="e.g. OpenRouter"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-provider-api-key">API key</Label>
              <div className="relative">
                <Key className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
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
            <div className="space-y-1">
              <Label htmlFor="new-provider-url">Base URL</Label>
              <Input
                id="new-provider-url"
                value={newProviderBaseUrl}
                onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleAddProvider}>Add provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => (open ? onDeleteOpen() : onDeleteClose())}
      >
        <DialogContent className="border-0 p-5">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4" />
              Delete provider
            </DialogTitle>
            <DialogDescription className="text-xs">
              This removes the provider and its models from these settings.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Delete <strong>{providerToDelete}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteProvider}>
              Delete provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
