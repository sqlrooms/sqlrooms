import * as React from 'react';
import {CircleAlert, RotateCw} from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {cliDuckDbConnector} from '../store';

function useDuckDbConnectionStatus() {
  return React.useSyncExternalStore(
    cliDuckDbConnector.subscribeConnectionStatus,
    () => cliDuckDbConnector.connectionStatus,
    () => cliDuckDbConnector.connectionStatus,
  );
}

export function CliDuckDbConnectionLostDialog() {
  const status = useDuckDbConnectionStatus();
  const hasConnectedRef = React.useRef(status === 'connected');
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === 'connected') {
      hasConnectedRef.current = true;
      setIsOpen(false);
      return;
    }

    if (status === 'disconnected' && hasConnectedRef.current) {
      setIsOpen(true);
    }
  }, [status]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl gap-8 px-10 py-12 sm:rounded-lg"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border-4 border-red-500 text-red-500">
          <CircleAlert className="size-8" strokeWidth={2.5} />
        </div>

        <DialogHeader className="items-center space-y-0 text-center">
          <DialogTitle className="text-3xl leading-tight font-bold">
            Connection to DuckDB Lost
          </DialogTitle>
          <DialogDescription className="sr-only">
            The connection to the local SQLRooms DuckDB backend was lost.
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground mx-auto max-w-lg space-y-6 text-lg leading-8">
          <p>
            The connection to your local SQLRooms DuckDB backend was lost.
          </p>
          <p>
            This typically happens when the SQLRooms CLI process exits or the
            local UI server is stopped.
          </p>
          <div>
            <p>To reconnect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-7">
              <li>
                Restart the same <code>sqlrooms</code> command in your terminal.
              </li>
              <li>Reload this browser tab after the server is running.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            className="gap-2"
            type="button"
            onClick={() => window.location.reload()}
          >
            <RotateCw className="size-4" />
            Reload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
