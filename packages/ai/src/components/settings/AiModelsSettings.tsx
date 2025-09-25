import React, {FC, useMemo, useState} from 'react';
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
import {
  Blocks,
  CirclePlus,
  Cpu,
  Key,
  Plus,
  Server,
  Settings,
  Trash2,
} from 'lucide-react';
import {useStoreWithAiSettings} from '../../AiSettingsSlice';
import {useStoreWithAi} from '../../AiSlice';

export interface AiModelsSettingsProps {
  showProviderModels?: boolean;
  showCustomModels?: boolean;
  allowEditProviderModels?: boolean;
  allowCustomModels?: boolean;
  className?: string;
}

export const AiModelsSettings: FC<AiModelsSettingsProps> = ({
  className = '',
  allowEditProviderModels = true,
  allowCustomModels = true,
}) => {
  const {toast} = useToast();
  const aiConfig = useStoreWithAiSettings((s) => s.getAiSettings());
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);
  const addModelToProvider = useStoreWithAiSettings(
    (s) => s.addModelToProvider,
  );
  const removeModelFromProvider = useStoreWithAiSettings(
    (s) => s.removeModelFromProvider,
  );
  const addCustomModel = useStoreWithAiSettings((s) => s.addCustomModel);
  const updateCustomModel = useStoreWithAiSettings((s) => s.updateCustomModel);
  const removeCustomModel = useStoreWithAiSettings((s) => s.removeCustomModel);

  const providers = useMemo(
    () => Object.entries(aiConfig.providers),
    [aiConfig.providers],
  );
  const customModels = aiConfig.customModels || [];

  // Dialog state for adding a custom model
  const {
    isOpen: isCustomModelDialogOpen,
    onOpen: openCustomModelDialog,
    onClose: closeCustomModelDialog,
  } = useDisclosure();
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [baseUrlError, setBaseUrlError] = useState(false);

  // Dialog state for editing a custom model
  const {
    isOpen: isEditCustomModelDialogOpen,
    onOpen: openEditCustomModelDialog,
    onClose: closeEditCustomModelDialog,
  } = useDisclosure();
  const [editingModel, setEditingModel] = useState<{
    oldModelName: string;
    modelName: string;
    baseUrl: string;
    apiKey: string;
  } | null>(null);
  const [editBaseUrlError, setEditBaseUrlError] = useState(false);

  // Dialog state for adding a model to a provider
  const {
    isOpen: isAddProviderModelDialogOpen,
    onOpen: openAddProviderModelDialog,
    onClose: closeAddProviderModelDialog,
  } = useDisclosure();
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [newModelName, setNewModelName] = useState('');

  // Dialog state for deleting a model
  const {
    isOpen: isDeleteModelDialogOpen,
    onOpen: openDeleteModelDialog,
    onClose: closeDeleteModelDialog,
  } = useDisclosure();
  const [modelToDelete, setModelToDelete] = useState<{
    type: 'provider' | 'custom';
    providerKey?: string;
    modelName: string;
  } | null>(null);

  const handleAddCustomToSession = () => {
    // Reset error states
    setBaseUrlError(false);

    // Validate required fields
    if (!customName.trim()) {
      toast({
        title: 'Model Name Required',
        description: 'Please enter a model name.',
        variant: 'destructive',
      });
      return;
    }

    if (!customBaseUrl.trim()) {
      setBaseUrlError(true);
      toast({
        title: 'Base URL Required',
        description: 'Please enter a base URL for the model.',
        variant: 'destructive',
      });
      return;
    }

    const trimmedName = customName.trim();

    // Add the custom model to the config
    addCustomModel(customBaseUrl.trim(), customApiKey.trim(), trimmedName);

    // Update the current session to use this custom model
    setAiModel('custom', trimmedName);

    // Show success message
    toast({
      title: 'Custom Model Added',
      description: `Successfully added "${trimmedName}" to your custom models.`,
      variant: 'default',
    });

    // Reset form
    setCustomName('');
    setCustomBaseUrl('');
    setCustomApiKey('');
    setBaseUrlError(false);
    closeCustomModelDialog();
  };

  const handleEditCustomModel = (modelName: string) => {
    const customModel = customModels.find((cm) => cm.modelName === modelName);
    if (customModel) {
      setEditingModel({
        oldModelName: modelName,
        modelName: modelName,
        baseUrl: customModel.baseUrl,
        apiKey: customModel.apiKey,
      });
      setEditBaseUrlError(false);
      openEditCustomModelDialog();
    }
  };

  const handleUpdateCustomModel = () => {
    if (!editingModel) return;

    // Reset error states
    setEditBaseUrlError(false);

    // Validate required fields
    if (!editingModel.modelName.trim()) {
      toast({
        title: 'Model Name Required',
        description: 'Please enter a model name.',
        variant: 'destructive',
      });
      return;
    }

    if (!editingModel.baseUrl.trim()) {
      setEditBaseUrlError(true);
      toast({
        title: 'Base URL Required',
        description: 'Please enter a base URL for the model.',
        variant: 'destructive',
      });
      return;
    }

    const trimmedName = editingModel.modelName.trim();
    const trimmedBaseUrl = editingModel.baseUrl.trim();
    const trimmedApiKey = editingModel.apiKey.trim();

    // Check for duplicate model names (excluding the current model being edited)
    const duplicateModel = customModels.find(
      (cm) =>
        cm.modelName.toLowerCase() === trimmedName.toLowerCase() &&
        cm.modelName !== editingModel.oldModelName,
    );

    if (duplicateModel) {
      toast({
        title: 'Model Name Already Exists',
        description: `A custom model with the name "${trimmedName}" already exists.`,
        variant: 'destructive',
      });
      return;
    }

    // Update the custom model
    updateCustomModel(
      editingModel.oldModelName,
      trimmedBaseUrl,
      trimmedApiKey,
      trimmedName,
    );

    // Show success message
    toast({
      title: 'Custom Model Updated',
      description: `Successfully updated "${trimmedName}".`,
      variant: 'default',
    });

    // Reset form and close dialog
    setEditingModel(null);
    setEditBaseUrlError(false);
    closeEditCustomModelDialog();
  };

  const handleOpenAddProviderModelDialog = (providerKey: string) => {
    setSelectedProviderKey(providerKey);
    setNewModelName('');
    openAddProviderModelDialog();
  };

  const handleAddModelToProvider = () => {
    if (!selectedProviderKey || !newModelName.trim()) return;

    // Check for duplicates
    const provider = aiConfig.providers[selectedProviderKey];
    const modelExists = provider?.models.some(
      (model) =>
        model.modelName.toLowerCase() === newModelName.trim().toLowerCase(),
    );

    if (modelExists) {
      toast({
        title: 'Model Already Exists',
        description: `The model "${newModelName.trim()}" already exists in this provider.`,
        variant: 'destructive',
      });
      return;
    }

    addModelToProvider(selectedProviderKey, newModelName.trim());
    setNewModelName('');
    closeAddProviderModelDialog();
  };

  const handleDeleteModel = (
    type: 'provider' | 'custom',
    providerKey: string | undefined,
    modelName: string,
  ) => {
    setModelToDelete({type, providerKey, modelName});
    openDeleteModelDialog();
  };

  const confirmDeleteModel = () => {
    if (!modelToDelete) return;

    if (modelToDelete.type === 'provider' && modelToDelete.providerKey) {
      removeModelFromProvider(
        modelToDelete.providerKey,
        modelToDelete.modelName,
      );
      toast({
        title: 'Model Deleted',
        description: `Successfully removed "${modelToDelete.modelName}" from the provider.`,
        variant: 'default',
      });
    } else if (modelToDelete.type === 'custom') {
      removeCustomModel(modelToDelete.modelName);
      toast({
        title: 'Custom Model Deleted',
        description: `Successfully removed "${modelToDelete.modelName}" from custom models.`,
        variant: 'default',
      });
    }

    setModelToDelete(null);
    closeDeleteModelDialog();
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-md flex items-center gap-2 pb-4 font-medium">
        <Blocks className="h-4 w-4" />
        Models
      </label>

      {/* Providers and their models */}
      <div className="w-full space-y-4">
        {providers.map(([providerKey, provider]) => (
          <div key={providerKey} className="flex w-full items-start gap-4">
            {/* Provider name column - 30% */}
            <div className="flex w-20 items-start justify-start text-sm font-medium">
              {providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}
            </div>

            {/* Models column - 65% (fills the rest) */}
            <div className="flex flex-1 flex-col items-start gap-2">
              {provider.models.map((m) => (
                <div
                  key={m.modelName}
                  className="flex w-full items-center justify-between gap-2 border-b p-1 text-xs"
                >
                  <span className="text-foreground/90">{m.modelName}</span>
                  {allowEditProviderModels && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        handleDeleteModel('provider', providerKey, m.modelName)
                      }
                      className="h-6 w-6 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {allowEditProviderModels && (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => handleOpenAddProviderModelDialog(providerKey)}
                >
                  <CirclePlus className="h-3 w-3" />
                  Add
                </Button>
              )}
            </div>

            {/* add model button column - 5% */}
            <div className="flex w-12 items-start justify-end"></div>
          </div>
        ))}

        {/* Custom models */}
        {allowCustomModels && (
          <div className="flex w-full items-start gap-4">
            <div className="flex w-20 items-start justify-start text-sm font-medium">
              Custom
            </div>
            <div className="flex flex-1 flex-col items-start gap-2">
              {customModels.map((cm) => (
                <div
                  key={cm.modelName}
                  className="flex w-full items-center justify-between gap-2 border-b p-1 text-xs"
                >
                  <span className="text-foreground/90">{cm.modelName}</span>
                  <div className="flex w-full items-center justify-end">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        handleDeleteModel('custom', undefined, cm.modelName)
                      }
                      className="h-6 w-6 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleEditCustomModel(cm.modelName)}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setCustomName('');
                  setCustomBaseUrl('');
                  setCustomApiKey('');
                  setBaseUrlError(false);
                  openCustomModelDialog();
                }}
              >
                <CirclePlus className="h-3 w-3" />
                Add
              </Button>
            </div>
            <div className="flex w-12 items-start justify-end"></div>
          </div>
        )}
      </div>

      {/* Add Custom Model Dialog */}
      {allowCustomModels && (
        <Dialog
          open={isCustomModelDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              openCustomModelDialog();
            } else {
              setBaseUrlError(false);
              closeCustomModelDialog();
            }
          }}
        >
          <DialogTrigger asChild>
            {/* handled via onOpen button above */}
          </DialogTrigger>
          <DialogContent className="border-0 p-5">
            <DialogHeader className="mb-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Blocks className="h-4 w-4" /> Add Custom Model
              </DialogTitle>
              <DialogDescription className="text-xs">
                Provide connection details for your model provider.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label htmlFor="custom-name" className="w-20 text-sm">
                  Name
                </Label>
                <div className="relative flex-1">
                  <Cpu className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="custom-name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., My cool model"
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="custom-baseUrl" className="w-20 text-sm">
                  baseUrl
                </Label>
                <div className="relative flex-1">
                  <Server className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="custom-baseUrl"
                    value={customBaseUrl}
                    onChange={(e) => {
                      setCustomBaseUrl(e.target.value);
                      if (baseUrlError && e.target.value.trim()) {
                        setBaseUrlError(false);
                      }
                    }}
                    placeholder="https://api.example.com"
                    className={`pl-8 ${baseUrlError ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="custom-apiKey" className="w-20 text-sm">
                  API key
                </Label>
                <div className="relative flex-1">
                  <Key className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="custom-apiKey"
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Optional"
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleAddCustomToSession}>
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Model to Provider Dialog */}
      <Dialog
        open={isAddProviderModelDialogOpen}
        onOpenChange={(open) =>
          open ? openAddProviderModelDialog() : closeAddProviderModelDialog()
        }
      >
        <DialogTrigger asChild>
          {/* handled via onOpen button above */}
        </DialogTrigger>
        <DialogContent className="border-0 p-5">
          <DialogHeader className="mb-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Blocks className="h-4 w-4" /> Add Model to Provider
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new model to{' '}
              {selectedProviderKey &&
                selectedProviderKey.charAt(0).toUpperCase() +
                  selectedProviderKey.slice(1)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label htmlFor="new-model-name" className="w-24 text-sm">
                Model Name
              </Label>
              <div className="relative flex-1">
                <Cpu className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="new-model-name"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="e.g., gpt-4-turbo"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleAddModelToProvider}>
                <Plus className="mr-2 h-4 w-4" /> Add Model
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Custom Model Dialog */}
      {allowCustomModels && (
        <Dialog
          open={isEditCustomModelDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              openEditCustomModelDialog();
            } else {
              setEditBaseUrlError(false);
              closeEditCustomModelDialog();
            }
          }}
        >
          <DialogTrigger asChild>
            {/* handled via onOpen button above */}
          </DialogTrigger>
          <DialogContent className="border-0 p-5">
            <DialogHeader className="mb-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" /> Edit Custom Model
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update the connection details for your custom model.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label htmlFor="edit-model-name" className="w-20 text-sm">
                  Name
                </Label>
                <div className="relative flex-1">
                  <Cpu className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="edit-model-name"
                    value={editingModel?.modelName || ''}
                    onChange={(e) =>
                      setEditingModel((prev) =>
                        prev ? {...prev, modelName: e.target.value} : null,
                      )
                    }
                    placeholder="e.g., My cool model"
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="edit-model-baseUrl" className="w-20 text-sm">
                  baseUrl
                </Label>
                <div className="relative flex-1">
                  <Server className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="edit-model-baseUrl"
                    value={editingModel?.baseUrl || ''}
                    onChange={(e) => {
                      setEditingModel((prev) =>
                        prev ? {...prev, baseUrl: e.target.value} : null,
                      );
                      if (editBaseUrlError && e.target.value.trim()) {
                        setEditBaseUrlError(false);
                      }
                    }}
                    placeholder="https://api.example.com"
                    className={`pl-8 ${editBaseUrlError ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="edit-model-apiKey" className="w-20 text-sm">
                  API key
                </Label>
                <div className="relative flex-1">
                  <Key className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="edit-model-apiKey"
                    type="password"
                    value={editingModel?.apiKey || ''}
                    onChange={(e) =>
                      setEditingModel((prev) =>
                        prev ? {...prev, apiKey: e.target.value} : null,
                      )
                    }
                    placeholder="Optional"
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingModel(null);
                    setEditBaseUrlError(false);
                    closeEditCustomModelDialog();
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleUpdateCustomModel}>
                  <Settings className="mr-2 h-4 w-4" /> Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Model Confirmation Dialog */}
      {(allowEditProviderModels || allowCustomModels) && (
        <Dialog
          open={isDeleteModelDialogOpen}
          onOpenChange={(open) =>
            open ? openDeleteModelDialog() : closeDeleteModelDialog()
          }
        >
          <DialogTrigger asChild>
            {/* handled via onOpen button above */}
          </DialogTrigger>
          <DialogContent className="border-0 p-5">
            <DialogHeader className="mb-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Trash2 className="h-4 w-4 text-red-500" /> Delete Model
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to delete &quot;{modelToDelete?.modelName}
                &quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModelToDelete(null);
                  closeDeleteModelDialog();
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmDeleteModel}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
