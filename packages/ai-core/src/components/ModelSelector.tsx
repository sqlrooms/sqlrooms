import React, {useMemo} from 'react';
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
import {useStoreWithAi} from '../AiSlice';
import {capitalize} from '@sqlrooms/utils';
import {hasAiSettingsConfig} from '../hasAiSettingsConfig';
import {extractModelsFromSettings} from '../utils';

interface Model {
  provider: string;
  label: string;
  value: string;
}

interface ModelSelectorProps {
  className?: string;
  models?: Model[];
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  className,
  models: passedModels,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);

  const aiSettingsConfig = useStoreWithAi((s) =>
    hasAiSettingsConfig(s) ? s.aiSettings.config : undefined,
  );
  const settingsModels = useMemo(
    () => (aiSettingsConfig ? extractModelsFromSettings(aiSettingsConfig) : []),
    [aiSettingsConfig],
  );

  const models = passedModels ?? settingsModels;

  const handleModelChange = (value: string) => {
    const selectedModel = models.find((model) => model.value === value);
    if (selectedModel) {
      setAiModel(selectedModel.provider, value);
    }
  };

  if (!currentSession) return null;

  const currentModel = currentSession.model;
  const currentModelDetails = models.find((m) => m.value === currentModel);

  // Group models by provider
  const modelsByProvider = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider]!.push(model);
      return acc;
    },
    {} as Record<string, Model[]>,
  );

  return (
    <div className={className}>
      <Select value={currentModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select AI Model">
            {currentModelDetails?.label ?? ''}
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
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
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
