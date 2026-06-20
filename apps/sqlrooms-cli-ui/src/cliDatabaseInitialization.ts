import {type DuckDbConnector} from '@sqlrooms/duckdb';
import {
  fetchRuntimeStartupStatus,
  type RuntimeConfig,
  type RuntimeStartupStatus,
} from './runtimeConfig';

const DB_INITIALIZATION_TIMEOUT_MS = 12_000;

type ErrorWithDetails = Error & {
  details?: string;
};

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  createError: () => Error,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(createError()), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

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
  startupStatus,
}: {
  wsUrl: string;
  clientError?: unknown;
  startupStatus?: RuntimeStartupStatus;
}): ErrorWithDetails {
  const duckdbError = getDuckDbStartupError(startupStatus);
  const message =
    duckdbError?.message ??
    'Could not connect to the SQLRooms DuckDB websocket backend.';
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
      await withTimeout(baseInitialize(), DB_INITIALIZATION_TIMEOUT_MS, () =>
        createDatabaseStartupError({wsUrl}),
      );
    } catch (error) {
      const startupStatus = await fetchRuntimeStartupStatus();
      throw createDatabaseStartupError({
        wsUrl,
        clientError: error,
        startupStatus,
      });
    }
  };
}
