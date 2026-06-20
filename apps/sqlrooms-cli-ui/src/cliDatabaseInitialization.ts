import {type DuckDbConnector} from '@sqlrooms/duckdb';
import {
  fetchRuntimeStartupStatus,
  type RuntimeConfig,
  type RuntimeStartupStatus,
} from './runtimeConfig';

const DB_CONNECTION_TIMEOUT_MS = 12_000;

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

function waitForWebSocketConnection(
  wsUrl: string,
  timeoutMs: number,
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

    socket.onopen = () => finish();
    socket.onerror = () =>
      finish(new Error('DuckDB websocket connection error.'));
    socket.onclose = () =>
      finish(new Error('DuckDB websocket closed before opening.'));
  });
}

export function addCliDatabaseInitializationDiagnostics(
  connector: DuckDbConnector,
  {
    runtimeConfig,
    wsUrl,
  }: {
    runtimeConfig: RuntimeConfig;
    wsUrl: string;
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
      await waitForWebSocketConnection(wsUrl, DB_CONNECTION_TIMEOUT_MS);
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
