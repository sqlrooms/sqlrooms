import {afterEach, expect, jest, test} from '@jest/globals';
import {createBrowserAuthorization} from '../src/browser-auth';
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  for (const key of ['location', 'history', 'sessionStorage'])
    Reflect.deleteProperty(globalThis, key);
});
test.each([undefined, 'same-origin'] as const)(
  'gateway cookies require an explicit option (%s), with same-origin bearer isolation',
  async (credentials) => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        href: 'https://roomie.test/',
        origin: 'https://roomie.test',
        pathname: '/',
        search: '',
        hash: '#sqlrooms-ticket=single-use',
      },
    });
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      value: {replaceState: jest.fn()},
    });
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        get length() {
          return values.size;
        },
        key: (i: number) => [...values.keys()][i],
        getItem: (k: string) => values.get(k),
        setItem: (k: string, v: string) => values.set(k, v),
        removeItem: (k: string) => values.delete(k),
      },
    });
    const session = {
      binding: 'binding',
      token: 'page-only',
      expiresAt: Date.now() / 1000 + 120,
    };
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (url) =>
          new Response(
            JSON.stringify(
              String(url).endsWith('auth.json')
                ? {binding: 'binding'}
                : session,
            ),
          ),
      );
    const auth = createBrowserAuthorization({
      product: 'sqlrooms',
      name: 'Roomie',
      credentials,
      credentialHeader: credentials ? 'x-sqlrooms-token' : undefined,
    });
    await auth.bootstrapAuthorization();
    await auth.authorizedFetch('/api/content');
    await jest.advanceTimersByTimeAsync(60001);
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(4);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe(credentials ?? 'omit');
      expect(init?.redirect).toBe('error');
    }
    const count = fetcher.mock.calls.length;
    await expect(auth.authorizedFetch('https://other.test/')).rejects.toThrow(
      'another origin',
    );
    expect(fetcher).toHaveBeenCalledTimes(count);
    expect(
      new Headers(fetcher.mock.calls[2]?.[1]?.headers).get(
        credentials ? 'X-SQLRooms-Token' : 'Authorization',
      ),
    ).toBe(credentials ? 'page-only' : 'Bearer page-only');
  },
);
