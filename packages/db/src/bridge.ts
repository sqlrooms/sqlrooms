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
  const bridgeBaseUrl = baseUrl.replace(/\/$/, '');

  const getErrorDetails = async (res: Response): Promise<string> => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const payload = (await res.json()) as {
          error?: unknown;
          message?: unknown;
        };
        if (typeof payload.error === 'string' && payload.error) {
          return payload.error;
        }
        if (typeof payload.message === 'string' && payload.message) {
          return payload.message;
        }
      } catch {
        return '';
      }
      return '';
    }
    try {
      return (await res.text()).trim();
    } catch {
      return '';
    }
  };

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${bridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const details = await getErrorDetails(res);
      throw new Error(
        `Bridge request failed (${res.status}) for ${path}${details ? `: ${details}` : ''}`,
      );
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
      const res = await fetch(`${bridgeBaseUrl}/api/db/fetch-arrow`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', ...headers},
        body: JSON.stringify({connectionId, sql}),
        signal,
      });
      if (!res.ok) {
        const details = await getErrorDetails(res);
        throw new Error(
          `Bridge fetchArrow failed (${res.status})${details ? `: ${details}` : ''}`,
        );
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
