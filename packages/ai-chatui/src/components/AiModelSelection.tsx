import {FC, useState, useEffect} from 'react';
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
  const aiConfigType = useStoreWithAiChatUi((s) => s.aiChatUi.type);
  const aiConfigDefaultModel = useStoreWithAiChatUi(
    (s) => s.aiChatUi.defaultModel,
  );
  const aiConfigCustomModel = useStoreWithAiChatUi(
    (s) => s.aiChatUi.customModel,
  );

  const setAiConfigType = useStoreWithAiChatUi(
    (s) => s.aiChatUi.setAiConfigType,
  );
  const setCustomModel = useStoreWithAiChatUi((s) => s.aiChatUi.setCustomModel);
  const setDefaultModel = useStoreWithAiChatUi(
    (s) => s.aiChatUi.setDefaultModel,
  );

  const setBaseUrl = useStoreWithAi((s) => s.ai.setBaseUrl);
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);
  const currentSessionModel = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.model,
  );
  const currentSessionProvider = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.modelProvider,
  );

  // Local state for inputs
  const [activeTab, setActiveTab] = useState(aiConfigType);
  const [customModelApiKey, setCustomModelApiKey] = useState(
    aiConfigCustomModel.apiKey || '',
  );
  const [customModelName, setCustomModelName] = useState(
    aiConfigCustomModel.modelName || '',
  );

  // Debug: Log the current store values
  useEffect(() => {
    console.log('AiModelSelection mounted/updated:', {
      aiConfigType,
      aiConfigDefaultModel,
      aiConfigCustomModel,
      activeTab,
    });
  }, [aiConfigType, aiConfigDefaultModel, aiConfigCustomModel, activeTab]);

  // Sync local state with store values after hydration (important for persistence)
  useEffect(() => {
    console.log('aiConfigType changed:', aiConfigType);
    setActiveTab(aiConfigType);
  }, [aiConfigType]);

  useEffect(() => {
    console.log('aiConfigCustomModel changed:', aiConfigCustomModel);
    setCustomModelApiKey(aiConfigCustomModel.apiKey || '');
    setCustomModelName(aiConfigCustomModel.modelName || '');
  }, [aiConfigCustomModel.apiKey, aiConfigCustomModel.modelName]);

  useEffect(() => {
    // update slice when <ModelSelector /> changed
    if (
      currentSessionModel &&
      currentSessionProvider &&
      currentSessionProvider !== CUSTOM_PROVIDER_NAME_FOR_API_KEY
    ) {
      setDefaultModel(currentSessionModel, currentSessionProvider);
    }
  }, [currentSessionModel, currentSessionProvider, setDefaultModel]);

  // useEffect(() => {
  //   // Initialize AI store with aiConfigSlice default model on mount
  //   if (
  //     aiConfigType === 'default' &&
  //     aiConfigDefaultModel.model &&
  //     aiConfigDefaultModel.provider
  //   ) {
  //     setAiModel(aiConfigDefaultModel.provider, aiConfigDefaultModel.model);
  //     setBaseUrl(getProxyBaseUrl?.());
  //   }
  // }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'default' | 'custom');
    setAiConfigType(value as 'default' | 'custom');

    if (value === 'default') {
      const selectedOption = modelOptions.find(
        (m) => m.label === aiConfigDefaultModel.model,
      );
      const selectedModelProvider =
        selectedOption?.provider || modelOptions[0]?.provider || 'openai';
      const selectedModelName =
        selectedOption?.label || modelOptions[0]?.label || 'gpt-4';
      setAiModel(selectedModelProvider, selectedModelName);
      setBaseUrl(getProxyBaseUrl?.());
    } else {
      // use 'custom' for other models which are openai compatible
      setAiModel(CUSTOM_PROVIDER_NAME_FOR_API_KEY, customModelName);
      setBaseUrl(aiConfigCustomModel.baseUrl);
    }
  };

  const onCustomModelBaseUrlChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputBaseUrl = e.target.value;
    setCustomModel(inputBaseUrl, customModelApiKey, customModelName);
    setBaseUrl(inputBaseUrl);
  };

  const onCustomModelApiKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputApiKey = e.target.value;
    setCustomModelApiKey(inputApiKey);
    setCustomModel(aiConfigCustomModel.baseUrl, inputApiKey, customModelName);
  };

  const onCustomModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const modelName = e.target.value;
    setCustomModelName(modelName);
    setCustomModel(aiConfigCustomModel.baseUrl, customModelApiKey, modelName);
  };

  const onDefaultModelApiKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputApiKey = e.target.value;
    setDefaultModel(
      aiConfigDefaultModel.model,
      aiConfigDefaultModel.provider,
      inputApiKey,
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-md flex items-center gap-2 pb-6 font-medium">
        <Cone className="h-4 w-4" />
        Model Selection
      </label>
      <Tabs
        value={activeTab}
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
          <div className="relative mt-2 flex items-center">
            <KeyIcon className="absolute left-2 h-4 w-4" />
            <Input
              className="w-full pl-8 text-xs"
              type="password"
              placeholder="API Key"
              value={aiConfigDefaultModel.apiKey}
              onChange={onDefaultModelApiKeyChange}
            />
          </div>
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
                value={customModelApiKey}
                onChange={onCustomModelApiKeyChange}
              />
            </div>
            <div className="relative flex items-center">
              <CpuIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-full pl-8 text-xs"
                type="text"
                placeholder="Model Name"
                value={customModelName}
                onChange={onCustomModelNameChange}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
