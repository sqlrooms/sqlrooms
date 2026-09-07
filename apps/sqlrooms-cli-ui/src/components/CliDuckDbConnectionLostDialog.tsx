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
import {cliDuckDbConnector, cliDuckDbWsUrl} from '../duckDbRuntime';
import {useCliRoomStoreApi} from '../roomStoreHooks';

const AUTO_RECONNECT_INITIAL_DELAY_MS = 1_000;
const AUTO_RECONNECT_MAX_DELAY_MS = 30_000;

function getAutoReconnectDelayMs(attempt: number) {
  return Math.min(
    AUTO_RECONNECT_INITIAL_DELAY_MS * 2 ** attempt,
    AUTO_RECONNECT_MAX_DELAY_MS,
  );
}

function formatServerEndpoint(wsUrl: string) {
  try {
    const url = new URL(wsUrl, window.location.href);
    return url.port ? `${url.hostname}:${url.port}` : url.host;
  } catch {
    return wsUrl;
  }
}

function useDuckDbConnectionStatus() {
  return React.useSyncExternalStore(
    cliDuckDbConnector.subscribeConnectionStatus,
    () => cliDuckDbConnector.connectionStatus,
    () => cliDuckDbConnector.connectionStatus,
  );
}

/**
 * Renders the SQLRooms server lost-connection dialog and manages automatic
 * WebSocket reconnect attempts without reloading the page.
 *
 * @returns Dialog content for lost SQLRooms server connections.
 */
export function CliDuckDbConnectionLostDialog() {
  const roomStore = useCliRoomStoreApi();
  const status = useDuckDbConnectionStatus();
  const serverEndpoint = React.useMemo(
    () => formatServerEndpoint(cliDuckDbWsUrl),
    [],
  );
  const hasConnectedRef = React.useRef(status === 'connected');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const retryInFlightRef = React.useRef(false);
  const autoReconnectAttemptRef = React.useRef(0);

  React.useEffect(() => {
    if (status === 'connected') {
      hasConnectedRef.current = true;
      setIsOpen(false);
      setIsRetrying(false);
      setRetryError(null);
      autoReconnectAttemptRef.current = 0;
      return;
    }

    if (status === 'disconnected' && hasConnectedRef.current) {
      setIsOpen(true);
    }
  }, [status]);

  const retryConnection = React.useCallback(
    async (showPending: boolean) => {
      if (retryInFlightRef.current) return false;
      retryInFlightRef.current = true;
      if (showPending) {
        setIsRetrying(true);
        setRetryError(null);
      }
      try {
        await cliDuckDbConnector.reconnect();
        void roomStore.getState().db.refreshTableSchemas();
        return true;
      } catch (error) {
        if (showPending) {
          setRetryError(
            error instanceof Error
              ? error.message
              : 'Could not reconnect to the SQLRooms server.',
          );
        }
        return false;
      } finally {
        retryInFlightRef.current = false;
        if (showPending) {
          setIsRetrying(false);
        }
      }
    },
    [roomStore],
  );

  React.useEffect(() => {
    if (!hasConnectedRef.current || status !== 'disconnected') return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleNextAttempt = () => {
      const delayMs = getAutoReconnectDelayMs(autoReconnectAttemptRef.current);
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        const reconnected = await retryConnection(false);
        if (cancelled || reconnected) return;
        autoReconnectAttemptRef.current += 1;
        scheduleNextAttempt();
      }, delayMs);
    };

    scheduleNextAttempt();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [retryConnection, status]);

  const handleRetry = React.useCallback(() => {
    autoReconnectAttemptRef.current = 0;
    void retryConnection(true);
  }, [retryConnection]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl gap-6 px-8 py-10 sm:rounded-lg"
      >
        <CircleAlert
          className="mx-auto size-14 text-red-500"
          strokeWidth={2.25}
        />

        <DialogHeader className="items-center space-y-0 text-center">
          <DialogTitle className="text-2xl leading-tight font-bold">
            Connection to SQLRooms server lost
          </DialogTitle>
          <DialogDescription className="sr-only">
            The connection to the local SQLRooms server was lost.
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground mx-auto max-w-md space-y-5 text-base leading-7">
          <p>
            The connection to your local SQLRooms server on{' '}
            <code>{serverEndpoint}</code> was lost.
          </p>
          <p>
            This typically happens when the SQLRooms CLI process exits or the
            local UI server is stopped.
          </p>
          <div>
            <p>To reconnect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                Restart the same <code>sqlrooms</code> command in your terminal.
              </li>
              <li>Wait for automatic reconnect, or retry manually.</li>
            </ul>
          </div>
          {retryError && (
            <p className="text-destructive text-sm leading-6">{retryError}</p>
          )}
        </div>

        <div className="flex justify-center">
          <Button
            className="gap-2"
            disabled={isRetrying}
            type="button"
            onClick={handleRetry}
          >
            <RotateCw
              className={isRetrying ? 'size-4 animate-spin' : 'size-4'}
            />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
