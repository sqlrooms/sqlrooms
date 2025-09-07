import {FC, useEffect} from 'react';
import {ServerIcon, KeyIcon, CpuIcon, Cone} from 'lucide-react';
import {Input, Tabs, TabsList, TabsTrigger, TabsContent} from '@sqlrooms/ui';
import {ModelSelector, useStoreWithAi} from '@sqlrooms/ai';
import {useStoreWithAiChatUi} from '../AiConfigSlice';

interface AiModelSelectionProps {
  modelOptions: Array<{provider: string; label: string; value: string}>;
  className?: string;
  getProxyBaseUrl?: () => string;
}

const CUSTOM_PROVIDER_NAME_FOR_API_KEY = 'custom';

export const AiModelSelection: FC<AiModelSelectionProps> = ({
  modelOptions,
  className = '',
  getProxyBaseUrl,
}) => {
  const aiConfigType = useStoreWithAiChatUi((s) => s.getAiConfig().type);
  const aiConfigModels = useStoreWithAiChatUi((s) => s.getAiConfig().models);
  const selectedModel = useStoreWithAiChatUi((s) => s.getSelectedModel());
  const aiConfigCustomModel = useStoreWithAiChatUi(
    (s) => s.getAiConfig().customModel,
  );

  const setAiConfigType = useStoreWithAiChatUi((s) => s.setAiConfigType);
  const setCustomModel = useStoreWithAiChatUi((s) => s.setCustomModel);
  const addModel = useStoreWithAiChatUi((s) => s.addModel);
  const updateModel = useStoreWithAiChatUi((s) => s.updateModel);
  const setSelectedModel = useStoreWithAiChatUi((s) => s.setSelectedModel);

  const setBaseUrl = useStoreWithAi((s) => s.ai.setBaseUrl);
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);
  const currentSessionModel = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.model,
  );
  const currentSessionProvider = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.modelProvider,
  );

  useEffect(() => {
    // update slice when <ModelSelector /> changed, maybe add onModelChange prop to <ModelSelector />
    if (
      currentSessionModel &&
      currentSessionProvider &&
      currentSessionProvider !== CUSTOM_PROVIDER_NAME_FOR_API_KEY
    ) {
      // Find existing model or add new one
      const existingModel = aiConfigModels.find(
        (m) =>
          m.model === currentSessionModel &&
          m.provider === currentSessionProvider,
      );

      if (existingModel) {
        setSelectedModel(existingModel.id);
      } else {
        // Add new model and select it
        const newModelId = addModel(
          currentSessionModel,
          currentSessionProvider,
        );
        setSelectedModel(newModelId);
      }
    }
  }, [
    currentSessionModel,
    currentSessionProvider,
    aiConfigModels,
    addModel,
    setSelectedModel,
  ]);

  const handleTabChange = (value: string) => {
    setAiConfigType(value as 'default' | 'custom');

    if (value === 'default') {
      if (selectedModel) {
        setAiModel(selectedModel.provider, selectedModel.model);
        setBaseUrl(getProxyBaseUrl?.());
      } else if (aiConfigModels.length > 0) {
        // Select the first available model
        const firstModel = aiConfigModels[0];
        if (firstModel) {
          setSelectedModel(firstModel.id);
          setAiModel(firstModel.provider, firstModel.model);
          setBaseUrl(getProxyBaseUrl?.());
        }
      }
    } else {
      // use 'custom' for other models which are openai compatible
      setAiModel(
        CUSTOM_PROVIDER_NAME_FOR_API_KEY,
        aiConfigCustomModel.modelName,
      );
      setBaseUrl(aiConfigCustomModel.baseUrl);
    }
  };

  const onCustomModelBaseUrlChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputBaseUrl = e.target.value;
    setCustomModel(
      inputBaseUrl,
      aiConfigCustomModel.apiKey,
      aiConfigCustomModel.modelName,
    );
    setBaseUrl(inputBaseUrl);
  };

  const onCustomModelApiKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputApiKey = e.target.value;
    setCustomModel(
      aiConfigCustomModel.baseUrl,
      inputApiKey,
      aiConfigCustomModel.modelName,
    );
  };

  const onCustomModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const modelName = e.target.value;
    setCustomModel(
      aiConfigCustomModel.baseUrl,
      aiConfigCustomModel.apiKey,
      modelName,
    );
  };

  const onDefaultModelApiKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputApiKey = e.target.value;
    if (selectedModel) {
      updateModel(selectedModel.id, {apiKey: inputApiKey});
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-md flex items-center gap-2 pb-6 font-medium">
        <Cone className="h-4 w-4" />
        Model Selection
      </label>
      <Tabs
        value={aiConfigType}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="default">Default</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        {/* Default Tab */}
        <TabsContent value="default" className="space-y-2">
          <ModelSelector models={modelOptions} className="w-full" />
          {selectedModel && (
            <div className="relative mt-2 flex items-center">
              <KeyIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-full pl-8 text-xs"
                type="password"
                placeholder="API Key"
                value={selectedModel.apiKey || ''}
                onChange={onDefaultModelApiKeyChange}
              />
            </div>
          )}
        </TabsContent>

        {/* Custom Tab */}
        <TabsContent value="custom" className="space-y-6">
          <div className="flex w-full flex-col gap-2">
            <div className="relative flex items-center">
              <ServerIcon className="absolute left-2 h-4 w-4 hover:cursor-pointer" />
              <Input
                className="w-full pl-8"
                type="text"
                placeholder="Server URL"
                value={aiConfigCustomModel.baseUrl}
                onChange={onCustomModelBaseUrlChange}
              />
            </div>
            <div className="relative flex items-center">
              <KeyIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-full pl-8 text-xs"
                type="password"
                placeholder="API Key"
                value={aiConfigCustomModel.apiKey}
                onChange={onCustomModelApiKeyChange}
              />
            </div>
            <div className="relative flex items-center">
              <CpuIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-full pl-8 text-xs"
                type="text"
                placeholder="Model Name"
                value={aiConfigCustomModel.modelName}
                onChange={onCustomModelNameChange}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
