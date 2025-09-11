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
import {Blocks, Cpu, Key, Plus, Server} from 'lucide-react';
import {useStoreWithAiModelConfig} from '../../AiConfigSlice';

export interface ModelConfigProps {
  currentSessionId: string;
  className?: string;
}

export const ModelsConfig: FC<ModelConfigProps> = ({
  currentSessionId,
  className = '',
}) => {
  const {toast} = useToast();
  const aiConfig = useStoreWithAiModelConfig((s) => s.getAiModelConfig());
  const setSessionCustomModel = useStoreWithAiModelConfig(
    (s) => s.setSessionCustomModel,
  );
  const addModelToProvider = useStoreWithAiModelConfig(
    (s) => s.addModelToProvider,
  );

  const providers = useMemo(
    () => Object.entries(aiConfig.models),
    [aiConfig.models],
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

  // Dialog state for adding a model to a provider
  const {
    isOpen: isAddProviderModelDialogOpen,
    onOpen: openAddProviderModelDialog,
    onClose: closeAddProviderModelDialog,
  } = useDisclosure();
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const handleAddCustomToSession = () => {
    if (!customName || !customBaseUrl) return;
    setSessionCustomModel(
      currentSessionId,
      customBaseUrl,
      customApiKey,
      customName,
    );
    setCustomName('');
    setCustomBaseUrl('');
    setCustomApiKey('');
    closeCustomModelDialog();
  };

  const handleOpenAddProviderModelDialog = (providerKey: string) => {
    setSelectedProviderKey(providerKey);
    setNewModelName('');
    openAddProviderModelDialog();
  };

  const handleAddModelToProvider = () => {
    if (!selectedProviderKey || !newModelName.trim()) return;

    // Check for duplicates
    const provider = aiConfig.models[selectedProviderKey];
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
              {provider.name}
            </div>

            {/* Models column - 65% (fills the rest) */}
            <div className="flex flex-1 flex-col items-start gap-2">
              {provider.models.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="text-foreground/90">{m.modelName}</span>
                </div>
              ))}
            </div>

            {/* add model button column - 5% */}
            <div className="flex w-12 items-start justify-end">
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleOpenAddProviderModelDialog(providerKey)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}

        {/* Custom models */}
        <div className="flex w-full items-start gap-4">
          <div className="flex w-20 items-start justify-start text-sm font-medium">
            Custom
          </div>
          <div className="flex flex-1 flex-col items-start gap-2">
            {customModels.map((cm) => (
              <div key={cm.id} className="flex items-center gap-2 text-sm">
                <span className="text-foreground/90">{cm.modelName}</span>
              </div>
            ))}
          </div>
          <div className="flex w-12 items-start justify-end">
            <Button size="xs" variant="outline" onClick={openCustomModelDialog}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add Custom Model Dialog */}
      <Dialog
        open={isCustomModelDialogOpen}
        onOpenChange={(open) =>
          open ? openCustomModelDialog() : closeCustomModelDialog()
        }
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
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="pl-8"
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
                aiConfig.models[selectedProviderKey]?.name}
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
    </div>
  );
};

ModelsConfig.displayName = 'ModelConfig';
