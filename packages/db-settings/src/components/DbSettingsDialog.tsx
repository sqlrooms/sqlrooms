import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {SettingsIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithDbSettings} from '../DbSettingsSlice';
import {ConnectorDriversDiagnostics} from './ConnectorDriversDiagnostics';
import {DbConnectionForm} from './DbConnectionForm';
import {DbConnectionsList} from './DbConnectionsList';

function DbSettingsDialogButton() {
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
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6">
            <SettingsIcon className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
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
}

function DbSettingsDialogContent() {
  return (
    <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
      <DialogHeader>
        <DialogTitle>Database Settings</DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="connections" className="flex min-h-0 w-full flex-col">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="connections" className="flex-1">
            Connections
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex-1">
            <DriversTabLabel />
          </TabsTrigger>
        </TabsList>
        <div className="mt-4 grid min-h-0 overflow-y-auto [&>*]:col-start-1 [&>*]:row-start-1">
          <TabsContent
            value="connections"
            forceMount
            className="space-y-4 data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
          >
            <DbConnectionsList />
            <DbConnectionForm />
          </TabsContent>
          <TabsContent
            value="drivers"
            forceMount
            className="data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
          >
            <ConnectorDriversDiagnostics.Summary />
            <div className="mt-3">
              <ConnectorDriversDiagnostics.List />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </DialogContent>
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

function DbSettingsDialogBase({children}: {children?: React.ReactNode}) {
  return (
    <Dialog>
      {children ?? (
        <>
          <DbSettingsDialogButton />
          <DbSettingsDialogContent />
        </>
      )}
    </Dialog>
  );
}

export const DbSettingsDialog = Object.assign(DbSettingsDialogBase, {
  Button: DbSettingsDialogButton,
  Content: DbSettingsDialogContent,
});
