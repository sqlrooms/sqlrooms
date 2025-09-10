import {FC} from 'react';
import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';

import {AiModelSelection} from './AiModelConfig';
import {AiModelParameters} from './AiModelParameters';
import {AiModelUsage, ModelUsageData} from './AiModelUsage';

interface AiConfigPanelProps {
  currentSessionId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  modelUsage?: ModelUsageData;
  hideDefaultApiKeyInput?: boolean;
  hideDefaultBaseUrlInput?: boolean;
  getDefaultInstructions?: () => string;
  onModelChange?: (provider: string, model: string) => void;
}

export const AiConfigPanel: FC<AiConfigPanelProps> = ({
  currentSessionId,
  isOpen,
  setIsOpen,
  modelUsage,
  hideDefaultApiKeyInput,
  hideDefaultBaseUrlInput,
  getDefaultInstructions,
  onModelChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-background border-border w-full rounded-lg border shadow-sm">
      <div className="relative flex flex-col gap-12 overflow-y-auto p-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="absolute right-2 top-2 z-10"
        >
          <X className="h-4 w-4" />
        </Button>
        <AiModelSelection
          hideDefaultApiKeyInput={hideDefaultApiKeyInput}
          hideDefaultBaseUrlInput={hideDefaultBaseUrlInput}
          currentSessionId={currentSessionId}
          onModelChange={onModelChange}
        />
        {modelUsage && (
          <AiModelUsage
            totalSpend={modelUsage.totalSpend}
            maxBudget={modelUsage.maxBudget}
            isLoadingSpend={modelUsage.isLoadingSpend}
            weeklySpend={modelUsage.weeklySpend}
            isLoadingWeeklySpend={modelUsage.isLoadingWeeklySpend}
          />
        )}
        <AiModelParameters getDefaultInstructions={getDefaultInstructions} />
      </div>
    </div>
  );
};
