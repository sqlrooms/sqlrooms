import React, {FC, useMemo} from 'react';
import {
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {capitalize} from '@sqlrooms/utils';
import {useStoreWithAiModelConfig} from '../../AiConfigSlice';
import {KeyIcon, ServerIcon} from 'lucide-react';

interface AiModelSelectorProps {
  className?: string;
  currentSessionId: string;
  hideDefaultApiKeyInput?: boolean;
  hideDefaultBaseUrlInput?: boolean;
  onModelChange?: (provider: string, model: string) => void;
}

export const AiModelSelector: FC<AiModelSelectorProps> = ({
  className = '',
  currentSessionId,
  hideDefaultApiKeyInput,
  hideDefaultBaseUrlInput,
  onModelChange,
}) => {
  const aiConfig = useStoreWithAiModelConfig((s) => s.getAiModelConfig());

  const modelsByProvider = useMemo(
    () =>
      Object.values(aiConfig.models).reduce(
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
      ),
    [aiConfig.models],
  );

  const setSessionSelectedModel = useStoreWithAiModelConfig(
    (s) => s.setSessionSelectedModel,
  );
  const setModelProviderApiKey = useStoreWithAiModelConfig(
    (s) => s.setModelProviderApiKey,
  );
  const updateProvider = useStoreWithAiModelConfig((s) => s.updateProvider);

  const selectedModelId = useStoreWithAiModelConfig((s) => {
    const session = s
      .getAiModelConfig()
      .sessions.find((ses) => ses.id === currentSessionId);
    return session?.selectedModelId || '';
  });

  const modelType = useStoreWithAiModelConfig((s) =>
    s.getModelTypeBySessionId(currentSessionId),
  );

  const customModel = useStoreWithAiModelConfig((s) =>
    s.getCustomModelBySessionId(currentSessionId),
  );

  const selectedModel = useMemo(() => {
    if (modelType === 'custom' && customModel) {
      return {
        id: 'custom',
        modelName: customModel.modelName,
        provider: 'custom',
        baseUrl: customModel.baseUrl,
        apiKey: customModel.apiKey,
      };
    }

    if (!selectedModelId) return null;
    for (const providerKey in aiConfig.models) {
      const provider = aiConfig.models[providerKey];
      if (provider) {
        const model = provider.models.find((m) => m.id === selectedModelId);
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
  }, [modelType, customModel, selectedModelId, aiConfig.models]);

  const currentModel = selectedModel?.id || '';
  const currentApiKey = selectedModel?.apiKey || '';
  const currentBaseUrl = selectedModel?.baseUrl || '';

  const handleModelChange = (value: string) => {
    setSessionSelectedModel(currentSessionId, value);
    // Determine provider for the newly selected model id
    let providerForModel = '';
    for (const providerKey in aiConfig.models) {
      const provider = aiConfig.models[providerKey];
      if (provider && provider.models.some((m) => m.id === value)) {
        providerForModel = provider.provider;
        break;
      }
    }
    onModelChange?.(providerForModel, value);
  };

  const onDefaultModelApiKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputApiKey = e.target.value;
    if (selectedModel) {
      setModelProviderApiKey(selectedModel.provider, inputApiKey);
    }
  };

  const onDefaultModelBaseUrlChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputBaseUrl = e.target.value;
    if (selectedModel) {
      updateProvider(selectedModel.provider, {
        // if empty, set to undefined so llm will use the default base url
        baseUrl: inputBaseUrl !== '' ? inputBaseUrl : undefined,
      });
    }
  };

  return (
    <>
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
      {!hideDefaultApiKeyInput && (
        <div className="relative mt-2 flex items-center">
          <KeyIcon className="absolute left-2 h-4 w-4" />
          <Input
            className="w-full pl-8 text-xs"
            type="password"
            placeholder="API Key"
            value={currentApiKey}
            onChange={onDefaultModelApiKeyChange}
          />
        </div>
      )}
      {!hideDefaultBaseUrlInput && (
        <div className="relative mt-2 flex items-center">
          <ServerIcon className="absolute left-2 h-4 w-4" />
          <Input
            className="w-full pl-8 text-xs"
            type="text"
            placeholder="Base URL"
            value={currentBaseUrl}
            onChange={onDefaultModelBaseUrlChange}
          />
        </div>
      )}
    </>
  );
};

AiModelSelector.displayName = 'AiModelSelector';
