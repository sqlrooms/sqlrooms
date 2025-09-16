import {FC, PropsWithChildren} from 'react';
import {Button} from '@sqlrooms/ui';
import {X} from 'lucide-react';

import {AiModelParameters} from './AiModelParameters';
import {AiModelUsage} from './AiModelUsage';
import {AiProvidersSettings} from './AiProvidersSettings';
import {AiModelsSettings} from './AiModelsSettings';

interface AiSettingsPanelProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const AiSettingsPanelBase: FC<
  PropsWithChildren<AiSettingsPanelProps>
> = ({isOpen, setIsOpen, children}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-background border-border w-full rounded-lg border shadow-sm">
      <div className="relative flex flex-col gap-12 overflow-y-auto p-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="absolute right-2 top-2 z-10"
        >
          <X className="h-4 w-4" />
        </Button>
        {children}
      </div>
    </div>
  );
};

export const AiSettingsPanel = Object.assign(AiSettingsPanelBase, {
  ProvidersConfig: AiProvidersSettings,
  ModelsConfig: AiModelsSettings,
  ModelUsage: AiModelUsage,
  ModelParameters: AiModelParameters,
});
