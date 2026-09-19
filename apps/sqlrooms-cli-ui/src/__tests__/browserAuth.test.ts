import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const originalFetch = globalThis.fetch;
let storage: Map<string, string>;
let replace: ReturnType<typeof jest.fn>;
const session = {
  token: 'page-secret',
  binding: 'instance-a',
  expiresAt: Date.now() / 1000 + 120,
};
const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {status});

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  storage = new Map();
  replace = jest.fn();
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://localhost:4173/#sqlrooms-ticket=once'),
  });
  Object.defineProperty(globalThis, 'history', {
    configurable: true,
    value: {replaceState: replace},
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      get length() {
        return storage.size;
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      getItem: (key: string) => storage.get(key),
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('explicit browser authorization', () => {
  test('removes fragment before any fetch, stores only page credential, rejects foreign URLs', async () => {
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url) => {
        expect(replace).toHaveBeenCalledWith(null, '', '/');
        return reply(
          url === '/auth.json' ? {binding: session.binding} : session,
        );
      });
    const auth = await import('../browserAuth');
    await auth.bootstrapAuthorization();
    expect(auth.pageCredential()).toBe(session.token);
    expect([...storage.keys()]).toEqual([
      'sqlrooms:authorization:http://localhost:4173:instance-a:page',
    ]);
    expect(() =>
      auth.authorizationHeaders('https://foreign.invalid/api/config'),
    ).toThrow('another origin');
    await auth.authorizedFetch('/api/config');
    const calls = (globalThis.fetch as jest.Mock<typeof fetch>).mock.calls;
    expect(calls[1]![1]).toMatchObject({
      body: JSON.stringify({ticket: 'once'}),
      redirect: 'error',
      credentials: 'omit',
    });
    const config = calls[2]![1]!;
    expect(new Headers(config.headers).get('Authorization')).toBe(
      'Bearer page-secret',
    );
    expect(config.redirect).toBe('error');
  });

  test('reload reuses storage but port reuse/new binding cannot inherit access', async () => {
    location.hash = '';
    storage.set(
      'sqlrooms:authorization:http://localhost:4173:instance-a:page',
      JSON.stringify(session),
    );
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(reply({binding: 'instance-a'}));
    const auth = await import('../browserAuth');
    await auth.bootstrapAuthorization();
    expect(auth.pageCredential()).toBe('page-secret');
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(reply({binding: 'instance-b'}));
    await expect(auth.bootstrapAuthorization()).rejects.toThrow(
      'authorization',
    );
    expect(() => auth.pageCredential()).toThrow('authorization');
    expect(storage.size).toBe(0);
  });

  test('blocked storage permits memory-only authorization', async () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        reply(url === '/auth.json' ? {binding: session.binding} : session),
      );
    const auth = await import('../browserAuth');
    await auth.bootstrapAuthorization();
    expect(auth.pageCredential()).toBe('page-secret');
    location.hash = '';
    await expect(auth.bootstrapAuthorization()).rejects.toThrow(
      'authorization',
    );
  });

  test('renewal retains socket token; failure does not extend expiry', async () => {
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        reply(url === '/auth.json' ? {binding: session.binding} : session),
      );
    const auth = await import('../browserAuth');
    await auth.bootstrapAuthorization();
    const renewed = {...session, expiresAt: session.expiresAt + 120};
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(reply(renewed));
    await jest.advanceTimersByTimeAsync(60_100);
    expect(auth.pageCredential()).toBe('page-secret');
    expect(JSON.parse([...storage.values()][0]!).expiresAt).toBe(
      renewed.expiresAt,
    );
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(reply({}, 401));
    await jest.advanceTimersByTimeAsync(120_000);
    expect(() => auth.pageCredential()).toThrow('authorization');
    expect(storage.size).toBe(0);
  });

  test('expired sessions and replay errors fail closed', async () => {
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        url === '/auth.json'
          ? reply({binding: session.binding})
          : reply({}, 401),
      );
    const auth = await import('../browserAuth');
    await expect(auth.bootstrapAuthorization()).rejects.toThrow(
      'authorization',
    );
    expect(storage.size).toBe(0);
  });

  test.each(['/sqlrooms/', '/nested/sqlrooms/index.html'])(
    'keeps bootstrap, configuration, sockets and renewal under %s',
    async (pathname) => {
      location.pathname = pathname;
      const base = pathname.replace(/index\.html$/, '');
      globalThis.fetch = jest
        .fn<typeof fetch>()
        .mockImplementation(async (url) => {
          if (url === `${base}auth.json`)
            return reply({binding: session.binding});
          if (url === `${base}api/config`)
            return reply({
              apiBaseUrl: 'https://untrusted.invalid',
              mcp: {enabled: true},
            });
          return reply(session);
        });
      const auth = await import('../browserAuth');
      await auth.bootstrapAuthorization();
      const {fetchRuntimeConfig, fetchRuntimeStartupStatus} =
        await import('../runtimeConfig');
      const config = await fetchRuntimeConfig();
      expect(config).toMatchObject({
        apiBaseUrl: base.slice(0, -1),
        wsUrl: `ws://localhost:4173${base}ws/duckdb`,
        crdtWsUrl: `ws://localhost:4173${base}ws/duckdb`,
        mcp: {bridgeUrl: `ws://localhost:4173${base}ws/mcp-bridge`},
      });
      await fetchRuntimeStartupStatus();
      await jest.advanceTimersByTimeAsync(60_100);
      const calls = (globalThis.fetch as jest.Mock<typeof fetch>).mock.calls;
      expect(calls.map(([url]) => url)).toEqual([
        `${base}auth.json`,
        `${base}api/auth/exchange`,
        `${base}api/config`,
        `${base}api/status`,
        `${base}api/auth/renew`,
      ]);
    },
  );

  test('database settings saves and connection tests use the host authorization transport', async () => {
    location.pathname = '/sqlrooms/';
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        reply(
          url === '/sqlrooms/auth.json' ? {binding: session.binding} : session,
        ),
      );
    const auth = await import('../browserAuth');
    await auth.bootstrapAuthorization();
    const {createDbSettingsSlice} = await import('@sqlrooms/db-settings');
    const {createStore} = await import('zustand/vanilla');
    const store = createStore(
      createDbSettingsSlice({
        fetch: (url, init) =>
          auth.authorizedFetch(auth.instancePath(url), init),
      }),
    );
    store.getState().dbSettings.upsertConnection({
      id: 'test',
      engineId: 'postgres',
      title: 'Test',
      runtimeSupport: 'server',
      requiresBridge: true,
      isCore: false,
    });
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(reply({ok: true}));
    expect(await store.getState().dbSettings.saveToServer()).toBe(true);
    expect(store.getState().dbSettings.hasUnsavedChanges).toBe(false);
    expect(
      await store.getState().dbSettings.testConnection('postgres', {}),
    ).toEqual({ok: true});
    const calls = (globalThis.fetch as jest.Mock<typeof fetch>).mock.calls;
    expect(calls.map(([url]) => url)).toEqual([
      '/sqlrooms/api/db/settings',
      '/sqlrooms/api/db/test-connection',
    ]);
    for (const [, init] of calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer page-secret',
      );
      expect(init?.redirect).toBe('error');
    }
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(reply({error: 'unauthorized'}, 401));
    store.getState().dbSettings.removeConnection('test');
    expect(await store.getState().dbSettings.saveToServer()).toBe(false);
    expect(store.getState().dbSettings.hasUnsavedChanges).toBe(true);
    expect(() => auth.pageCredential()).toThrow('authorization');
  });
});
