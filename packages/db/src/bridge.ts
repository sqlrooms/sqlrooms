import type {DbBridge} from './types';
import * as arrow from 'apache-arrow';
import {parseFramedBinaryStream} from './arrow-streaming';

type HttpBridgeOptions = {
  id: string;
  baseUrl: string;
  runtimeSupport?: DbBridge['runtimeSupport'];
  headers?: Record<string, string>;
};

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

  const cancelQuery = async (queryId: string) => {
    const result = await request<{cancelled: boolean}>('/api/db/cancel-query', {
      method: 'POST',
      body: JSON.stringify({queryId}),
    });
    return Boolean(result.cancelled);
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
      const buffer = new Uint8Array(await res.arrayBuffer());
      return arrow.tableFromIPC(buffer);
    },
    fetchArrowStream: ({connectionId, sql, signal, queryId, chunkRows}) => {
      const qid =
        queryId ||
        `bridge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return (async function* (): AsyncGenerator<Uint8Array> {
        const res = await fetch(`${bridgeBaseUrl}/api/db/fetch-arrow-stream`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', ...headers},
          body: JSON.stringify({connectionId, sql, queryId: qid, chunkRows}),
          signal,
        });
        if (!res.ok) {
          const details = await getErrorDetails(res);
          throw new Error(
            `Bridge fetchArrowStream failed (${res.status})${details ? `: ${details}` : ''}`,
          );
        }
        if (!res.body) {
          throw new Error('Bridge returned no stream body');
        }
        const onAbort = () => {
          void cancelQuery(qid);
        };
        signal?.addEventListener('abort', onAbort, {once: true});
        const reader = res.body.getReader();
        try {
          for await (const frame of parseFramedBinaryStream(reader)) {
            if (frame.type === 'batch') {
              yield frame.payload;
              continue;
            }
            if (frame.type === 'end') {
              return;
            }
            if (frame.type === 'error') {
              throw new Error(frame.error || 'Bridge stream error');
            }
          }
        } finally {
          signal?.removeEventListener('abort', onAbort);
          try {
            await reader.cancel();
          } catch {
            // no-op
          }
        }
      })();
    },
    cancelQuery,
  };
}
