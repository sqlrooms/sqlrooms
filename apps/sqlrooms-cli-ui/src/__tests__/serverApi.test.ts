import {afterEach, describe, expect, jest, test} from '@jest/globals';
import {fetchMcpStatus} from '../serverApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('fetchMcpStatus', () => {
  test('aborts a stalled status request before the polling interval', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn(
      (
        _url: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        void _url;
        signal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      },
    ) as typeof fetch;

    const request = fetchMcpStatus({apiBaseUrl: 'http://127.0.0.1:4173'});
    const rejection = expect(request).rejects.toThrow('aborted');
    await jest.advanceTimersByTimeAsync(1_000);

    await rejection;
    expect(signal?.aborted).toBe(true);
  });
});
