import {FC} from 'react';
import {ServerIcon, KeyIcon, CpuIcon, Cone} from 'lucide-react';
import {Input, Tabs, TabsList, TabsTrigger, TabsContent} from '@sqlrooms/ui';
import {useStoreWithAiModelConfig} from '../../AiConfigSlice';
import {AiModelSelector} from './AiModelSelector';

export interface AiModelSelectionProps {
  className?: string;
  hideDefaultApiKeyInput?: boolean;
  hideDefaultBaseUrlInput?: boolean;
  currentSessionId: string;
}

export const AiModelSelection: FC<AiModelSelectionProps> = ({
  className = '',
  currentSessionId,
}) => {
  const aiConfigType = useStoreWithAiModelConfig((s) =>
    s.getModelTypeBySessionId(currentSessionId),
  );
  // const aiConfigCustomModel = useStoreWithAiModelConfig((s) =>
  //   s.getCustomModelBySessionId(currentSessionId),
  // );
  const aiConfigCustomModel = {
    baseUrl: '',
    apiKey: '',
    modelName: '',
  };

  const setSessionModelType = useStoreWithAiModelConfig(
    (s) => s.setSessionModelType,
  );
  const setSessionCustomModel = useStoreWithAiModelConfig(
    (s) => s.setSessionCustomModel,
  );

  const handleTabChange = (value: string) => {
    setSessionModelType(currentSessionId, value as 'default' | 'custom');
  };

  const onCustomModelBaseUrlChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputBaseUrl = e.target.value;
    if (aiConfigCustomModel) {
      setSessionCustomModel(
        currentSessionId,
        inputBaseUrl,
        aiConfigCustomModel.apiKey,
        aiConfigCustomModel.modelName,
      );
    }
  };

  const onCustomModelApiKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputApiKey = e.target.value;
    if (aiConfigCustomModel) {
      setSessionCustomModel(
        currentSessionId,
        aiConfigCustomModel.baseUrl,
        inputApiKey,
        aiConfigCustomModel.modelName,
      );
    }
  };

  const onCustomModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const modelName = e.target.value;
    if (aiConfigCustomModel) {
      setSessionCustomModel(
        currentSessionId,
        aiConfigCustomModel.baseUrl,
        aiConfigCustomModel.apiKey,
        modelName,
      );
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
          <AiModelSelector
            className="w-full"
            currentSessionId={currentSessionId}
          />
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
                value={aiConfigCustomModel?.baseUrl || ''}
                onChange={onCustomModelBaseUrlChange}
              />
            </div>
            <div className="relative flex items-center">
              <KeyIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-full pl-8 text-xs"
                type="password"
                placeholder="API Key"
                value={aiConfigCustomModel?.apiKey || ''}
                onChange={onCustomModelApiKeyChange}
              />
            </div>
            <div className="relative flex items-center">
              <CpuIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-full pl-8 text-xs"
                type="text"
                placeholder="Model Name"
                value={aiConfigCustomModel?.modelName || ''}
                onChange={onCustomModelNameChange}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
