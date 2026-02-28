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
  const bridgeBaseUrl = baseUrl.replace(/\/$/, '');
  const textDecoder = new TextDecoder();

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

  const parseFramedStream = async function* (
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): AsyncGenerator<{type: string; payload: Uint8Array; error?: string}> {
    let buffer = new Uint8Array(0);
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        return;
      }
      const chunk = value ?? new Uint8Array(0);
      if (chunk.length > 0) {
        const next = new Uint8Array(buffer.length + chunk.length);
        next.set(buffer, 0);
        next.set(chunk, buffer.length);
        buffer = next;
      }
      while (buffer.length >= 4) {
        const headerLen = new DataView(
          buffer.buffer,
          buffer.byteOffset,
          4,
        ).getUint32(0, false);
        if (buffer.length < 4 + headerLen) {
          break;
        }
        const headerBytes = buffer.slice(4, 4 + headerLen);
        const header = JSON.parse(textDecoder.decode(headerBytes)) as {
          type?: string;
          payloadLength?: number;
          error?: string;
        };
        const payloadLength =
          typeof header.payloadLength === 'number' ? header.payloadLength : 0;
        const frameLen = 4 + headerLen + payloadLength;
        if (buffer.length < frameLen) {
          break;
        }
        const payload = buffer.slice(4 + headerLen, frameLen);
        yield {type: header.type || 'unknown', payload, error: header.error};
        buffer = buffer.slice(frameLen);
      }
    }
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
          for await (const frame of parseFramedStream(reader)) {
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
