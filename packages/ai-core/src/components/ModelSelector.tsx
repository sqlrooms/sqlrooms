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

const MODEL_KEY_SEPARATOR = '::';

const getModelSelectKey = (provider: string, modelValue: string): string =>
  `${provider}${MODEL_KEY_SEPARATOR}${modelValue}`;

const parseModelSelectKey = (
  selectValue: string,
): {provider: string; modelValue: string} | null => {
  const separatorIndex = selectValue.indexOf(MODEL_KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }

  return {
    provider: selectValue.slice(0, separatorIndex),
    modelValue: selectValue.slice(separatorIndex + MODEL_KEY_SEPARATOR.length),
  };
};

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

  const handleModelChange = (selectValue: string) => {
    const parsed = parseModelSelectKey(selectValue);
    if (parsed) {
      setAiModel(parsed.provider, parsed.modelValue);
    }
  };

  if (!currentSession) return null;

  const currentModel = currentSession.model;
  const currentModelProvider = currentSession.modelProvider;
  const currentSelectValue = getModelSelectKey(
    currentModelProvider,
    currentModel,
  );
  const currentModelDetails = models.find(
    (m) => m.provider === currentModelProvider && m.value === currentModel,
  );

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
      <Select value={currentSelectValue} onValueChange={handleModelChange}>
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
                    <SelectItem
                      key={getModelSelectKey(model.provider, model.value)}
                      value={getModelSelectKey(model.provider, model.value)}
                    >
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
