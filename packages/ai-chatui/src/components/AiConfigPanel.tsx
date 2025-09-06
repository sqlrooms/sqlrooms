import {FC} from 'react';

import {AiModelSelection} from './AiModelSelection';
import {AiModelParameters} from './AiModelParameters';
import {AiModelUsage} from './AiModelUsage';
import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';
import {ModelUsageData} from '../types';

interface AiConfigPanelProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  modelOptions: Array<{provider: string; label: string; value: string}>;
  modelUsage?: ModelUsageData;
  getProxyBaseUrl: () => string;
}

export const AiConfigPanel: FC<AiConfigPanelProps> = ({
  isOpen,
  setIsOpen,
  modelOptions,
  modelUsage,
  getProxyBaseUrl
}) => {

  if (!isOpen) return null;

  return (
    <div className="w-full bg-background border border-border rounded-lg shadow-sm">
      <div className="p-6 flex flex-col gap-12 overflow-y-auto relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="absolute top-2 right-2 z-10"
        >
          <X className="h-4 w-4" />
        </Button>
        <AiModelSelection
          modelOptions={modelOptions}
          getProxyBaseUrl={getProxyBaseUrl}
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
        <AiModelParameters />
      </div>
    </div>
  );
};
