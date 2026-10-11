import {
  Button,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {LoaderIcon, PlusIcon, SaveIcon, SettingsIcon} from 'lucide-react';
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
          aria-label="Database settings"
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
  const [showAddForm, setShowAddForm] = React.useState(false);

  return (
    <div className="space-y-3">
      {showAddForm ? (
        <DbConnectionForm onDone={() => setShowAddForm(false)} />
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm(true)}
        >
          <PlusIcon className="mr-1 h-3.5 w-3.5" />
          Add Connection
        </Button>
      )}
      <DbConnectionsList />
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

function DbSettingsSaveButton({apiBaseUrl}: {apiBaseUrl?: string}) {
  const saveToServer = useStoreWithDbSettings((s) => s.dbSettings.saveToServer);
  const isSaving = useStoreWithDbSettings((s) => s.dbSettings.isSaving);
  const hasUnsavedChanges = useStoreWithDbSettings(
    (s) => s.dbSettings.hasUnsavedChanges,
  );

  const handleSave = React.useCallback(async () => {
    const ok = await saveToServer(apiBaseUrl);
    if (ok) {
      toast.success('Settings saved', {
        description: 'Connection config written to sqlrooms.toml.',
      });
    } else {
      toast.error('Failed to save', {
        description: 'Check the console for details.',
      });
    }
  }, [saveToServer, apiBaseUrl]);

  return (
    <Button
      size="sm"
      onClick={handleSave}
      disabled={isSaving || !hasUnsavedChanges}
    >
      {isSaving ? (
        <LoaderIcon className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <SaveIcon className="mr-1 h-3.5 w-3.5" />
      )}
      {isSaving ? 'Saving…' : 'Save to config'}
    </Button>
  );
}

export const DbSettings = {
  TriggerButton: DbSettingsTriggerButton,
  SaveButton: DbSettingsSaveButton,
  Connections: DbSettingsConnections,
  Diagnostics: DbSettingsDiagnostics,
  DriversTabLabel,
  ConnectionsList: DbConnectionsList,
  ConnectionForm: DbConnectionForm,
};
