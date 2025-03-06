import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {useStoreWithAi} from './AiSlice';

const AI_MODELS = [
  {provider: 'openai', label: 'OpenAI GPT-4o-mini', value: 'gpt-4o-mini'},
  {provider: 'openai', label: 'OpenAI GPT-4o', value: 'gpt-4o'},
  {
    provider: 'anthropic',
    label: 'Anthropic Claude 3 Sonnet',
    value: 'claude-3-sonnet-20240229',
  },
  {
    provider: 'anthropic',
    label: 'Anthropic Claude 3 Opus',
    value: 'claude-3-opus-20240229',
  },
];

interface ModelSelectorProps {
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({className}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const setAiModel = useStoreWithAi((s) => s.ai.setAiModel);

  const handleModelChange = (value: string) => {
    const selectedModel = AI_MODELS.find((model) => model.value === value);
    if (selectedModel) {
      setAiModel(selectedModel.provider, value);
      // Provider change would be implemented here if needed
    }
  };

  if (!currentSession) return null;

  const currentModel = currentSession.model;
  const currentModelDetails = AI_MODELS.find(
    (m) => m.value === currentModel,
  ) || {provider: 'openai', label: currentModel, value: currentModel};

  return (
    <div className={className}>
      <Select value={currentModel} onValueChange={handleModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select AI Model">
            {currentModelDetails.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>OpenAI Models</SelectLabel>
            {AI_MODELS.filter((m) => m.provider === 'openai').map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Anthropic Models</SelectLabel>
            {AI_MODELS.filter((m) => m.provider === 'anthropic').map(
              (model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ),
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
