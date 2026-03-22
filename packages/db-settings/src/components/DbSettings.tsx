import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithDbSettings} from '../DbSettingsSlice';
import {ConnectorDriversDiagnostics} from './ConnectorDriversDiagnostics';
import {DbConnectionForm} from './DbConnectionForm';
import {DbConnectionsList} from './DbConnectionsList';

const DbSettingsTriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>((props, ref) => {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const missingCount = React.useMemo(
    () => diagnostics.filter((d) => !d.available).length,
    [diagnostics],
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          {...props}
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>
          DB Settings
          {missingCount > 0
            ? ` (${missingCount} driver${missingCount > 1 ? 's' : ''} missing)`
            : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  );
});
DbSettingsTriggerButton.displayName = 'DbSettings.TriggerButton';

function DbSettingsConnections() {
  return (
    <div className="space-y-4">
      <DbConnectionsList />
      <DbConnectionForm />
    </div>
  );
}

function DbSettingsDiagnostics() {
  return (
    <div>
      <ConnectorDriversDiagnostics.Summary />
      <div className="mt-3">
        <ConnectorDriversDiagnostics.List />
      </div>
    </div>
  );
}

function DriversTabLabel() {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const missingCount = React.useMemo(
    () => diagnostics.filter((d) => !d.available).length,
    [diagnostics],
  );

  return (
    <>
      Drivers
      {missingCount > 0 && (
        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-medium text-amber-700">
          {missingCount}
        </span>
      )}
    </>
  );
}

export const DbSettings = {
  TriggerButton: DbSettingsTriggerButton,
  Connections: DbSettingsConnections,
  Diagnostics: DbSettingsDiagnostics,
  DriversTabLabel,
  ConnectionsList: DbConnectionsList,
  ConnectionForm: DbConnectionForm,
};
