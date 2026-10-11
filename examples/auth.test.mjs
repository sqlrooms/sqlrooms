import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

for (const remainingSeconds of [10, 1800]) {
  test(`renews a restored credential with ${remainingSeconds}s remaining before expiry`, async (t) => {
    let now = 1_000_000;
    const page = {
      token: 'page-credential',
      binding: 'current-runtime',
      expiresAt: now / 1000 + remainingSeconds,
    };
    const location = new URL('http://localhost:5173/');
    const key = `sqlrooms-example:${location.origin}:${page.binding}`;
    const storage = new Map([[key, JSON.stringify(page)]]);
    const timers = [];
    const requests = [];
    let renewalSucceeds = true;
    for (const [name, value] of Object.entries({
      location,
      document: {getElementById: () => null},
      sessionStorage: {
        getItem: (key) => storage.get(key),
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    })) {
      const previous = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, {configurable: true, value});
      t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else delete globalThis[name];
      });
    }
    t.mock.method(Date, 'now', () => now);
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
      timers.push({callback, delay});
    });
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push({url, options});
      return {
        ok: url === '/auth.json' || renewalSucceeds,
        json: async () =>
          url === '/auth.json'
            ? {binding: page.binding}
            : {...page, expiresAt: now / 1000 + 900},
      };
    });

    // Each example runs this test against its own bootstrap, using Node's TS support.
    const source = pathToFileURL(path.resolve('src/auth.ts'));
    source.searchParams.set('test', String(remainingSeconds));
    const auth = await import(source.href);
    assert.equal(auth.pageToken, page.token);
    assert.equal(auth.databaseUrl.href, 'ws://localhost:5173/ws/duckdb');
    assert.equal(timers.length, 1);
    const first = timers.shift();
    assert.ok(first.delay >= 0 && first.delay < remainingSeconds * 1000);
    now += first.delay;
    await first.callback();
    assert.equal(requests.at(-1).url, '/api/auth/renew');
    assert.equal(
      requests.at(-1).options.headers.Authorization,
      `Bearer ${page.token}`,
    );
    assert.equal(JSON.parse(storage.get(key)).expiresAt, now / 1000 + 900);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 840_000);

    renewalSucceeds = false;
    const next = timers.shift();
    now += next.delay;
    await next.callback();
    assert.equal(storage.has(key), false);
    assert.equal(timers.length, 0);
  });
}
