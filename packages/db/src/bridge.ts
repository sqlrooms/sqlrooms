import type {DbBridge} from './types';
import * as arrow from 'apache-arrow';

type HttpBridgeOptions = {
  id: string;
  baseUrl: string;
  runtimeSupport?: DbBridge['runtimeSupport'];
  headers?: Record<string, string>;
};

export function createHttpDbBridge(options: HttpBridgeOptions): DbBridge {
  const {id, baseUrl, runtimeSupport = 'both', headers = {}} = options;

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      throw new Error(`Bridge request failed (${res.status}) for ${path}`);
    }
    return (await res.json()) as T;
  };

  return {
    id,
    runtimeSupport,
    testConnection: async (connectionId) => {
      const result = await request<{ok: boolean}>('/api/db/test-connection', {
        method: 'POST',
        body: JSON.stringify({connectionId}),
      });
      return Boolean(result.ok);
    },
    listCatalog: async (connectionId) => {
      return request('/api/db/list-catalog', {
        method: 'POST',
        body: JSON.stringify({connectionId}),
      });
    },
    executeQuery: async ({connectionId, sql, queryType, signal}) => {
      return request('/api/db/execute-query', {
        method: 'POST',
        body: JSON.stringify({connectionId, sql, queryType}),
        signal,
      });
    },
    fetchArrow: async ({connectionId, sql, signal}) => {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/api/db/fetch-arrow`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json', ...headers},
          body: JSON.stringify({connectionId, sql}),
          signal,
        },
      );
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          let parsedError: string | undefined;
          try {
            const body = (await res.json()) as {error?: string};
            parsedError = body.error;
          } catch {
            parsedError = undefined;
          }
          if (parsedError) {
            throw new Error(parsedError);
          }
        }
        throw new Error(`Bridge fetchArrow failed (${res.status})`);
      }
      const buffer = new Uint8Array(await res.arrayBuffer());
      return arrow.tableFromIPC(buffer);
    },
    cancelQuery: async (queryId) => {
      const result = await request<{cancelled: boolean}>(
        '/api/db/cancel-query',
        {
          method: 'POST',
          body: JSON.stringify({queryId}),
        },
      );
      return Boolean(result.cancelled);
    },
  };
}
