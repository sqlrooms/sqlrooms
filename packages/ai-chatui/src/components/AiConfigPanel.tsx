import {FC} from 'react';

import {AiModelSelection} from './AiModelConfig';
import {AiModelParameters} from './AiModelParameters';
import {AiModelUsage} from './AiModelUsage';
import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';
import {ModelUsageData} from '../types';

interface AiConfigPanelProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  modelUsage?: ModelUsageData;
  hideDefaultApiKeyInput?: boolean;
  hideDefaultBaseUrlInput?: boolean;
  getDefaultInstructions?: (tables: unknown[]) => string;
}

export const AiConfigPanel: FC<AiConfigPanelProps> = ({
  isOpen,
  setIsOpen,
  modelUsage,
  hideDefaultApiKeyInput,
  hideDefaultBaseUrlInput,
  getDefaultInstructions,
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
