import type {DbBridge} from './types';
import * as arrow from 'apache-arrow';

type HttpBridgeOptions = {
  id: string;
  baseUrl: string;
  runtimeSupport?: DbBridge['runtimeSupport'];
  headers?: Record<string, string>;
};

function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js fallback
  const nodeBuffer = Buffer.from(value, 'base64');
  return new Uint8Array(
    nodeBuffer.buffer,
    nodeBuffer.byteOffset,
    nodeBuffer.byteLength,
  );
}

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
    executeQuery: async ({connectionId, sql, queryType}) => {
      return request('/api/db/execute-query', {
        method: 'POST',
        body: JSON.stringify({connectionId, sql, queryType}),
      });
    },
    fetchArrow: async ({connectionId, sql}) => {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/api/db/fetch-arrow`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json', ...headers},
          body: JSON.stringify({connectionId, sql}),
        },
      );
      if (!res.ok) {
        throw new Error(`Bridge fetchArrow failed (${res.status})`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = (await res.json()) as {
          arrowBase64?: string;
          error?: string;
        };
        if (!body.arrowBase64) {
          throw new Error(body.error || 'Bridge returned no Arrow payload');
        }
        const bytes = decodeBase64ToBytes(body.arrowBase64);
        return arrow.tableFromIPC(bytes);
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
