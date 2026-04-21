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
import {CirclePlus, Cone, Server, Settings, Trash2} from 'lucide-react';
import {useStoreWithAiSettings} from '../AiSettingsSlice';

export const AiProvidersSettings: FC<{apiBaseUrl?: string}> = ({
  apiBaseUrl,
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
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');

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
    if (!newProviderKey.trim()) return;
    if (providers[newProviderKey]) {
      toast.error('Provider already exists');
      return;
    }
    addProvider(
      newProviderKey.trim(),
      newProviderBaseUrl.trim(),
      newProviderTitle.trim() || newProviderKey.trim(),
    );
    setNewProviderKey('');
    setNewProviderTitle('');
    setNewProviderBaseUrl('');
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-md flex items-center gap-2 font-medium">
            <Cone className="h-4 w-4" />
            Provider manifest
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} size="sm">
              Save
            </Button>
            <Button onClick={onOpen} variant="secondary" size="sm">
              <CirclePlus className="mr-2 h-3 w-3" />
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
                <div className="flex items-center gap-3">
                  <Label className="w-24 shrink-0 text-sm">
                    {provider.title || providerKey}
                  </Label>
                  <Input
                    value={provider.baseUrl}
                    onChange={(e) =>
                      updateProvider(providerKey, {baseUrl: e.target.value})
                    }
                    placeholder="Provider base URL"
                    className="flex-1"
                  />
                  {provider.experimental && (
                    <Badge variant="secondary">Experimental</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProvider(providerKey)}
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
                  <div className="mt-3 space-y-3 pl-24">
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
                          {provider.authMethods.map((method) => (
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
                        {provider.authMethods.map((method) => (
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
              Create a provider manifest entry. Authentication methods can be
              refined in the config file or by the local CLI backend.
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
    </div>
  );
};
