import React, {FC} from 'react';
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
  getProxyBaseUrl?: () => string;
  setBaseUrl: (url: string | undefined) => void;
  setAiModel: (provider: string, model: string) => void;
}

export interface AiModelSelectorRef {
  handleTabChange: (value: string) => void;
}

export const AiModelSelector: FC<AiModelSelectorProps> = ({
  className = '',
  getProxyBaseUrl,
  setBaseUrl,
  setAiModel,
}) => {
  // AI Chat UI slice state and actions
  const getAiConfig = useStoreWithAiChatUi((s) => s.getAiConfig);
  const getSelectedModel = useStoreWithAiChatUi((s) => s.getSelectedModel);
  const setSelectedModel = useStoreWithAiChatUi((s) => s.setSelectedModel);

  const aiConfig = getAiConfig();
  const selectedModel = getSelectedModel();

  const handleModelChange = (value: string) => {
    setSelectedModel(value);

    const model = aiConfig.models.find((m) => m.id === value);
    if (model) {
      setAiModel(model.provider, model.model);
      setBaseUrl(getProxyBaseUrl?.());
    }
  };

  const currentModel = selectedModel?.id || '';

  // Group models by provider
  const modelsByProvider = aiConfig.models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider]!.push(model);
      return acc;
    },
    {} as Record<string, typeof aiConfig.models>,
  );

  return (
    <div className={className}>
      <Select value={currentModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select AI Model">
            {selectedModel
              ? `${selectedModel.provider} - ${selectedModel.model}`
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
                      {model.model}
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
