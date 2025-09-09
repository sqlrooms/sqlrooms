import React, {FC, useMemo} from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {useStoreWithAiChatUi} from '../AiConfigSlice';
import {capitalize} from '@sqlrooms/utils';

interface AiModelSelectorProps {
  className?: string;
}

export interface AiModelSelectorRef {
  handleTabChange: (value: string) => void;
}

export const AiModelSelector: FC<AiModelSelectorProps> = ({className = ''}) => {
  // AI Chat UI slice state and actions
  const aiConfig = useStoreWithAiChatUi((s) => s.getAiConfig());
  const setSelectedModel = useStoreWithAiChatUi((s) => s.setSelectedModel);

  // Memoize the selected model to prevent infinite re-renders
  const selectedModel = useMemo(() => {
    const {models, selectedModelId} = aiConfig;
    if (!selectedModelId) return null;

    // Find the model across all providers
    for (const providerKey in models) {
      const provider = models[providerKey];
      if (provider) {
        const model = provider.models.find(
          (model) => model.id === selectedModelId,
        );
        if (model) {
          return {
            id: model.id,
            modelName: model.modelName,
            provider: provider.provider,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
          };
        }
      }
    }
    return null;
  }, [aiConfig]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const currentModel = selectedModel?.id || '';

  // Group models by provider
  const modelsByProvider = Object.values(aiConfig.models).reduce(
    (acc, provider) => {
      if (provider) {
        if (!acc[provider.provider]) {
          acc[provider.provider] = [];
        }
        acc[provider.provider]!.push(...provider.models);
      }
      return acc;
    },
    {} as Record<string, Array<{id: string; modelName: string}>>,
  );

  return (
    <div className={className}>
      <Select value={currentModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select AI Model">
            {selectedModel
              ? `${selectedModel.provider} - ${selectedModel.modelName}`
              : ''}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(modelsByProvider).map(
            ([provider, providerModels]) => (
              <React.Fragment key={provider}>
                <SelectGroup>
                  <SelectLabel className="text-muted-foreground/50 text-center text-sm font-bold">
                    {capitalize(provider)}
                  </SelectLabel>
                  {providerModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.modelName}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
              </React.Fragment>
            ),
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

AiModelSelector.displayName = 'AiModelSelector';
