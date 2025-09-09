import {FC, useMemo} from 'react';
import {ServerIcon, KeyIcon, CpuIcon, Cone} from 'lucide-react';
import {Input, Tabs, TabsList, TabsTrigger, TabsContent} from '@sqlrooms/ui';
import {AiModelSelector} from './AiModelSelector';
import {useStoreWithAiChatUi} from '../../AiConfigSlice';
import {getSelectedModel, getApiKey, getBaseUrl} from '../../utils';

interface AiModelSelectionProps {
  className?: string;
  hideDefaultApiKeyInput?: boolean;
  hideDefaultBaseUrlInput?: boolean;
}

export const AiModelSelection: FC<AiModelSelectionProps> = ({
  className = '',
  hideDefaultApiKeyInput,
  hideDefaultBaseUrlInput,
}) => {
  const aiConfig = useStoreWithAiChatUi((s) => s.getAiConfig());
  const aiConfigType = aiConfig.type;
  const aiConfigCustomModel = aiConfig.customModel;

  // actions
  const setAiConfigType = useStoreWithAiChatUi((s) => s.setAiConfigType);
  const setCustomModel = useStoreWithAiChatUi((s) => s.setCustomModel);
  const setModelProviderApiKey = useStoreWithAiChatUi(
    (s) => s.setModelProviderApiKey,
  );
  const updateProvider = useStoreWithAiChatUi((s) => s.updateProvider);

  // Memoize the selected model to prevent infinite re-renders
  const selectedModel = useMemo(() => {
    return getSelectedModel(aiConfig);
  }, [aiConfig]);

  // Get the current API key and baseUrl for the selected model
  const currentApiKey = getApiKey(aiConfig);
  const currentBaseUrl = getBaseUrl(aiConfig) || '';

  const handleTabChange = (value: string) => {
    setAiConfigType(value as 'default' | 'custom');
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
          <TabsTrigger value="default">Provider</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        {/* Default Tab */}
        <TabsContent value="default" className="space-y-2">
          <AiModelSelector className="w-full" />
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
