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

test.each([
  {
    gatewayAuth: true,
    credentials: 'same-origin' as const,
    advertised: true,
    https: true,
    ok: true,
  },
  {
    gatewayAuth: false,
    credentials: 'same-origin' as const,
    advertised: true,
    https: true,
    ok: false,
  },
  {
    gatewayAuth: true,
    credentials: 'omit' as const,
    advertised: true,
    https: true,
    ok: false,
  },
  {
    gatewayAuth: true,
    credentials: 'same-origin' as const,
    advertised: false,
    https: true,
    ok: false,
  },
  {
    gatewayAuth: true,
    credentials: 'same-origin' as const,
    advertised: true,
    https: false,
    ok: false,
  },
])(
  'gateway session bootstrap requires explicit opt-in, host advertisement and HTTPS: %j',
  async (options) => {
    jest.useFakeTimers();
    const origin = `${options.https ? 'https' : 'http'}://roomie.test`;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {href: origin + '/', origin, pathname: '/', search: '', hash: ''},
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
    let binding = 'first';
    const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith('auth.json')
              ? {
                  binding,
                  ...(options.advertised
                    ? {browserAuth: 'trusted-gateway'}
                    : {}),
                }
              : {
                  binding,
                  token: 'page-' + binding,
                  expiresAt: Date.now() / 1000 + 120,
                },
          ),
        ),
    );
    const auth = createBrowserAuthorization({
      product: 'sqlrooms',
      name: 'Roomie',
      credentials: options.credentials,
      gatewayAuth: options.gatewayAuth,
    });
    if (!options.ok) {
      await expect(auth.bootstrapAuthorization()).rejects.toThrow(
        'authorization is required',
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
      return;
    }
    await auth.bootstrapAuthorization();
    expect(auth.pageCredential()).toBe('page-first');
    expect(fetcher.mock.calls[1]).toEqual([
      '/api/auth/gateway',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: {'Content-Type': 'application/json'},
      }),
    ]);
    await auth.bootstrapAuthorization(); // Reuse this tab's valid session.
    expect(fetcher).toHaveBeenCalledTimes(3);
    binding = 'restarted';
    await auth.bootstrapAuthorization(); // A host restart replaces the bound session without a ticket.
    expect(auth.pageCredential()).toBe('page-restarted');
    expect(fetcher).toHaveBeenCalledTimes(5);
    await jest.advanceTimersByTimeAsync(120001); // Renewal remains on the existing credential path.
    expect(fetcher.mock.calls.some(([url]) => url === '/api/auth/renew')).toBe(
      true,
    );
  },
);
