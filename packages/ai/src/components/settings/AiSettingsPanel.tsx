import {FC, PropsWithChildren} from 'react';
import {Button, UseDisclosureReturnValue} from '@sqlrooms/ui';
import {X} from 'lucide-react';

import {AiModelParameters} from './AiModelParameters';
import {AiModelUsage} from './AiModelUsage';
import {AiProvidersSettings} from './AiProvidersSettings';
import {AiModelsSettings} from './AiModelsSettings';

interface AiSettingsPanelProps {
  disclosure: UseDisclosureReturnValue;
}

export const AiSettingsPanelBase: FC<
  PropsWithChildren<AiSettingsPanelProps>
> = ({disclosure, children}) => {
  const {isOpen, onClose} = disclosure;
  if (!isOpen) return null;

  return (
    <div className="bg-background border-border w-full rounded-lg border shadow-sm">
      <div className="relative flex flex-col gap-12 overflow-y-auto p-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
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
  ProvidersSettings: AiProvidersSettings,
  ModelsSettings: AiModelsSettings,
  ModelUsage: AiModelUsage,
  ModelParametersSettings: AiModelParameters,
});
