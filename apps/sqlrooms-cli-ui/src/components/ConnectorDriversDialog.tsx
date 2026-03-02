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

function DriverInstallCommands({
  diagnostic,
}: {
  diagnostic: ConnectorDiagnostic;
}) {
  const {toast} = useToast();
  const installCommands = diagnostic.installCommands || {};
  const commands = [
    installCommands.uvProject,
    installCommands.uvxRelaunch,
    installCommands.uvxWith,
  ].filter((value): value is string => Boolean(value));

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
  const missingConnectors = React.useMemo(
    () => connectorDiagnostics.filter((item) => item.available === false),
    [connectorDiagnostics],
  );

  if (!missingConnectors.length) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Install Drivers ({missingConnectors.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Missing Connector Drivers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {missingConnectors.map((diagnostic) => (
            <div key={diagnostic.id} className="rounded border p-3">
              <div className="font-medium">
                {diagnostic.title} ({diagnostic.engineId})
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {diagnostic.error ||
                  'Driver is not installed in this Python environment.'}
              </div>
              {diagnostic.requiredPackages?.length ? (
                <div className="mt-2 text-xs">
                  Required package:{' '}
                  <code>{diagnostic.requiredPackages.join(', ')}</code>
                </div>
              ) : null}
              <DriverInstallCommands diagnostic={diagnostic} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
