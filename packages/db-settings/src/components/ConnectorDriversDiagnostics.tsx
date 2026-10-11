import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {DatabaseIcon} from 'lucide-react';
import React from 'react';
import type {ConnectorDriverDiagnostic} from '../DbSettingsSliceConfig';
import {useStoreWithDbSettings} from '../DbSettingsSlice';

function getInstallCommands(diagnostic: ConnectorDriverDiagnostic): string[] {
  const installCommands = diagnostic.installCommands ?? {};
  return [
    installCommands.uvProject,
    installCommands.uvxRelaunch,
    installCommands.uvxWith,
  ].filter((value): value is string => Boolean(value));
}

function DriverInstallCommands({
  diagnostic,
}: {
  diagnostic: ConnectorDriverDiagnostic;
}) {
  const commands = getInstallCommands(diagnostic);
  if (!commands.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {commands.map((command) => (
        <div key={command} className="bg-muted rounded border p-2">
          <div className="text-xs">
            <code>{command}</code>
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(command);
                  toast.success('Command copied', {
                    description:
                      'Paste it into your terminal and restart sqlrooms.',
                  });
                } catch {
                  toast.error('Clipboard unavailable', {
                    description: 'Copy the command manually from the dialog.',
                  });
                }
              }}
            >
              Copy command
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiagnosticsHint() {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const supportedEngines = useStoreWithDbSettings(
    (s) => s.dbSettings.config.supportedEngines,
  );
  const hasMissing = diagnostics.some((d) => !d.available);

  const engineList =
    supportedEngines.length > 0 ? (
      supportedEngines.map((e, i) => (
        <span key={e}>
          {i > 0 && ', '}
          <strong>{e}</strong>
        </span>
      ))
    ) : (
      <em>none reported</em>
    );

  return (
    <div className="text-muted-foreground rounded border border-dashed p-3 text-xs leading-relaxed">
      {diagnostics.length === 0 ? (
        <p>
          No connector drivers detected. Add a connection in the{' '}
          <strong>Connections</strong> tab and restart sqlrooms to see driver
          status here.
        </p>
      ) : hasMissing ? (
        <>
          <p>
            To install a missing driver, copy one of the commands shown above,
            run it in your terminal, then restart sqlrooms.
          </p>
          <p className="mt-2">
            If you launched via{' '}
            <code className="bg-muted rounded px-1">uvx</code>, use the{' '}
            <code className="bg-muted rounded px-1">uvx --from</code> or{' '}
            <code className="bg-muted rounded px-1">uvx --with</code> variant to
            include the driver package in the ephemeral environment.
          </p>
        </>
      ) : (
        <p>
          All configured drivers are installed. Supported engines: {engineList}.
          Support for additional engines requires adding a connector plugin to
          the sqlrooms-cli backend.
        </p>
      )}
    </div>
  );
}

function DiagnosticsList() {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const sortedDiagnostics = React.useMemo(
    () =>
      [...diagnostics].sort((a, b) =>
        `${a.title}:${a.engineId}`.localeCompare(`${b.title}:${b.engineId}`),
      ),
    [diagnostics],
  );

  if (!diagnostics.length) {
    return <DiagnosticsHint />;
  }

  return (
    <div className="space-y-4">
      {sortedDiagnostics.map((diagnostic) => (
        <div
          key={`${diagnostic.id}:${diagnostic.engineId}`}
          className="rounded border p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">
              {diagnostic.title} ({diagnostic.engineId})
            </div>
            <span
              className={
                diagnostic.available
                  ? 'rounded border border-green-600/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-700'
                  : 'rounded border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700'
              }
            >
              {diagnostic.available ? 'Installed' : 'Missing'}
            </span>
          </div>
          {!diagnostic.available ? (
            <div className="text-muted-foreground mt-1 text-sm">
              {diagnostic.error ||
                'Driver is not installed in this Python environment.'}
            </div>
          ) : (
            <div className="text-muted-foreground mt-1 text-sm">
              Driver is available in the current Python environment.
            </div>
          )}
          {!diagnostic.available && diagnostic.requiredPackages?.length ? (
            <div className="mt-2 text-xs">
              {`Required package${diagnostic.requiredPackages.length > 1 ? 's' : ''}: `}
              <code>{diagnostic.requiredPackages.join(', ')}</code>
            </div>
          ) : null}
          {!diagnostic.available ? (
            <DriverInstallCommands diagnostic={diagnostic} />
          ) : null}
        </div>
      ))}
      <DiagnosticsHint />
    </div>
  );
}

function DiagnosticsSummary() {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const {missingCount, installedCount} = React.useMemo(() => {
    const missing = diagnostics.filter((d) => d.available === false);
    return {
      missingCount: missing.length,
      installedCount: diagnostics.length - missing.length,
    };
  }, [diagnostics]);

  if (!diagnostics.length) return null;

  return (
    <div className="text-muted-foreground text-sm">
      Installed: {installedCount} &middot; Missing: {missingCount}
    </div>
  );
}

function DiagnosticsButton() {
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const {missingCount, installedCount} = React.useMemo(() => {
    const missing = diagnostics.filter((d) => d.available === false);
    return {
      missingCount: missing.length,
      installedCount: diagnostics.length - missing.length,
    };
  }, [diagnostics]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6">
            <DatabaseIcon className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>
          Connector drivers ({installedCount} installed
          {missingCount > 0 ? `, ${missingCount} missing` : ''})
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function DiagnosticsDialog({children}: {children?: React.ReactNode}) {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Connector Drivers</DialogTitle>
      </DialogHeader>
      <DiagnosticsSummary />
      {children ?? <DiagnosticsList />}
    </DialogContent>
  );
}

function ConnectorDriversDiagnosticsBase({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <Dialog>
      {children ?? (
        <>
          <DiagnosticsButton />
          <DiagnosticsDialog />
        </>
      )}
    </Dialog>
  );
}

export const ConnectorDriversDiagnostics = Object.assign(
  ConnectorDriversDiagnosticsBase,
  {
    Button: DiagnosticsButton,
    Dialog: DiagnosticsDialog,
    List: DiagnosticsList,
    Summary: DiagnosticsSummary,
    Hint: DiagnosticsHint,
  },
);
