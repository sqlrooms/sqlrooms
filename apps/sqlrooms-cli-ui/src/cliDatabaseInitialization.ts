import {type DuckDbConnector} from '@sqlrooms/duckdb';
import {
  fetchRuntimeStartupStatus,
  type RuntimeConfig,
  type RuntimeStartupStatus,
} from './runtimeConfig';

const DB_CONNECTION_TIMEOUT_MS = 12_000;
const DB_CONNECTION_ATTEMPT_TIMEOUT_MS = 1_000;
const DB_CONNECTION_RETRY_DELAY_MS = 250;

type ErrorWithDetails = Error & {
  details?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown client-side initialization error.';
}

function getDuckDbStartupError(status?: RuntimeStartupStatus) {
  const duckdbStatus = status?.components?.duckdbWebSocket;
  if (duckdbStatus?.status !== 'error') return undefined;
  return duckdbStatus;
}

function createDatabaseStartupError({
  wsUrl,
  clientError,
  fallbackMessage = 'Could not connect to the SQLRooms DuckDB websocket backend.',
  startupStatus,
}: {
  wsUrl: string;
  clientError?: unknown;
  fallbackMessage?: string;
  startupStatus?: RuntimeStartupStatus;
}): ErrorWithDetails {
  const duckdbError = getDuckDbStartupError(startupStatus);
  const message = duckdbError?.message ?? fallbackMessage;
  const details = [
    duckdbError?.error ? `Server error: ${duckdbError.error}` : undefined,
    duckdbError?.details
      ? `Server details:\n${duckdbError.details}`
      : undefined,
    clientError ? `Client error: ${getErrorMessage(clientError)}` : undefined,
    `WebSocket URL: ${wsUrl}`,
    'Check the terminal running `sqlrooms` for startup errors, then reload this page.',
  ].filter(Boolean);

  const error = new Error(message) as ErrorWithDetails;
  error.details = details.join('\n\n');
  return error;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openWebSocketConnection(
  wsUrl: string,
  timeoutMs: number,
  authToken?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Ignore cleanup errors after the connection result is known.
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    timeoutId = setTimeout(() => {
      finish(new Error('Timed out connecting to DuckDB websocket backend.'));
    }, timeoutMs);

    socket.onopen = () => {
      if (!authToken) {
        finish();
        return;
      }

      try {
        socket.send(JSON.stringify({type: 'auth', token: authToken}));
      } catch {
        finish(new Error('Failed to send DuckDB websocket auth token.'));
      }
    };
    socket.onmessage = (event) => {
      if (!authToken || typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'authAck') {
          finish();
        } else if (message?.type === 'error') {
          finish(new Error(message.error || 'DuckDB websocket auth failed.'));
        }
      } catch {
        // Ignore non-JSON messages while waiting for auth acknowledgement.
      }
    };
    socket.onerror = () =>
      finish(new Error('DuckDB websocket connection error.'));
    socket.onclose = () =>
      finish(new Error('DuckDB websocket closed before opening.'));
  });
}

async function waitForWebSocketConnection(
  wsUrl: string,
  timeoutMs: number,
  authToken?: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const attemptRemainingMs = deadline - Date.now();
    try {
      await openWebSocketConnection(
        wsUrl,
        Math.min(DB_CONNECTION_ATTEMPT_TIMEOUT_MS, attemptRemainingMs),
        authToken,
      );
      return;
    } catch (error) {
      lastError = error;
      const startupStatus = await fetchRuntimeStartupStatus();
      if (getDuckDbStartupError(startupStatus)) {
        throw error;
      }
    }

    const retryRemainingMs = deadline - Date.now();
    if (retryRemainingMs > 0) {
      await delay(Math.min(DB_CONNECTION_RETRY_DELAY_MS, retryRemainingMs));
    }
  }

  throw (
    lastError ?? new Error('Timed out connecting to DuckDB websocket backend.')
  );
}

/**
 * Wraps a connector's `initialize` method with CLI database startup diagnostics.
 *
 * This mutates `connector.initialize` so startup failures can surface backend
 * status details and websocket timeout diagnostics to the room shell.
 *
 * @param connector - Database connector whose initializer should be wrapped.
 * @param options - Runtime configuration and websocket URL used for diagnostics.
 * @param options.runtimeConfig - CLI runtime configuration, including startup status.
 * @param options.wsUrl - DuckDB websocket URL to probe before initialization.
 */
export function addCliDatabaseInitializationDiagnostics(
  connector: DuckDbConnector,
  {
    runtimeConfig,
    wsUrl,
    authToken,
  }: {
    runtimeConfig: RuntimeConfig;
    wsUrl: string;
    authToken?: string;
  },
) {
  const baseInitialize = connector.initialize.bind(connector);
  connector.initialize = async () => {
    const initialStartupError = getDuckDbStartupError(
      runtimeConfig.startupStatus,
    );
    if (initialStartupError) {
      throw createDatabaseStartupError({
        wsUrl,
        startupStatus: runtimeConfig.startupStatus,
      });
    }

    try {
      await waitForWebSocketConnection(
        wsUrl,
        DB_CONNECTION_TIMEOUT_MS,
        authToken,
      );
    } catch (error) {
      const startupStatus = await fetchRuntimeStartupStatus();
      throw createDatabaseStartupError({
        wsUrl,
        clientError: error,
        startupStatus,
      });
    }

    try {
      await baseInitialize();
    } catch (error) {
      const startupStatus = await fetchRuntimeStartupStatus();
      throw createDatabaseStartupError({
        wsUrl,
        clientError: error,
        fallbackMessage: 'SQLRooms DuckDB initialization failed.',
        startupStatus,
      });
    }
  };
}
