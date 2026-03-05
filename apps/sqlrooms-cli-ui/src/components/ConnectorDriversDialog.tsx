import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useToast,
} from '@sqlrooms/ui';
import React from 'react';
import {useRoomStore} from '../store';

type ConnectorDiagnostic = ReturnType<
  typeof useRoomStore.getState
>['connectorDriverDiagnostics'][number];

const selectConnectorDiagnostics = (
  state: ReturnType<typeof useRoomStore.getState>,
) => state.connectorDriverDiagnostics;

function getInstallCommands(diagnostic: ConnectorDiagnostic): string[] {
  const installCommands = diagnostic.installCommands || {};
  return [
    installCommands.uvProject,
    installCommands.uvxRelaunch,
    installCommands.uvxWith,
  ].filter((value): value is string => Boolean(value));
}

function DriverInstallCommands({
  diagnostic,
}: {
  diagnostic: ConnectorDiagnostic;
}) {
  const {toast} = useToast();
  const commands = getInstallCommands(diagnostic);

  if (!commands.length) {
    return null;
  }

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
                  toast({
                    title: 'Command copied',
                    description:
                      'Paste it into your terminal and restart sqlrooms.',
                  });
                } catch {
                  toast({
                    variant: 'destructive',
                    title: 'Clipboard unavailable',
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

export const ConnectorDriversDialog: React.FC = () => {
  const connectorDiagnostics = useRoomStore(selectConnectorDiagnostics);
  const {missingCount, installedCount} = React.useMemo(() => {
    const missing = connectorDiagnostics.filter(
      (item) => item.available === false,
    );
    return {
      missingCount: missing.length,
      installedCount: connectorDiagnostics.length - missing.length,
    };
  }, [connectorDiagnostics]);
  const sortedDiagnostics = React.useMemo(
    () =>
      [...connectorDiagnostics].sort((a, b) =>
        `${a.title}:${a.engineId}`.localeCompare(`${b.title}:${b.engineId}`),
      ),
    [connectorDiagnostics],
  );

  if (!connectorDiagnostics.length) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="xs" variant="outline">
          Connectors
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connector Drivers</DialogTitle>
        </DialogHeader>
        <div className="text-muted-foreground text-sm">
          Installed: {installedCount} · Missing: {missingCount}
        </div>
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
                  Required package:{' '}
                  <code>{diagnostic.requiredPackages.join(', ')}</code>
                </div>
              ) : null}
              {!diagnostic.available ? (
                <DriverInstallCommands diagnostic={diagnostic} />
              ) : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
