import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCliDevHosts,
  getPythonCliDevArgs,
  hasDbPathArg,
  shouldProxyCliDevWebSockets,
} from './cli-dev-args.mjs';

test('external URL option values are not treated as database paths', () => {
  for (const args of [
    ['--external-url', 'https://example.test'],
    ['--external-url=https://example.test'],
    ['--external-ws-url', 'wss://example.test/ws/duckdb'],
    ['--external-ws-url=wss://example.test/ws/duckdb'],
  ]) {
    assert.equal(hasDbPathArg(args), false, args.join(' '));
  }
});

test('explicit external URLs still receive a development database path', () => {
  for (const args of [
    ['--external-url', 'https://example.test'],
    ['--external-url=https://example.test'],
  ]) {
    const result = getPythonCliDevArgs(args, 4273, 3100);
    assert.notEqual(result.indexOf('--db-path'), -1, args.join(' '));
  }
});

test('explicit WebSocket URLs bypass the Vite WebSocket proxy', () => {
  for (const args of [
    ['--external-ws-url', 'wss://example.test/ws/duckdb'],
    ['--external-ws-url=wss://example.test/ws/duckdb'],
  ]) {
    assert.equal(
      shouldProxyCliDevWebSockets(args, {externalWsUrl: null}),
      false,
      args.join(' '),
    );
  }

  assert.equal(
    shouldProxyCliDevWebSockets([], {
      externalWsUrl: 'wss://example.test/ws/duckdb',
    }),
    false,
  );
  assert.equal(shouldProxyCliDevWebSockets([], {externalWsUrl: null}), true);
});

test('a dash-prefixed database path after -- is preserved', () => {
  const args = ['--', '-dev.db'];
  const result = getPythonCliDevArgs(args, 4273, 3100);

  assert.equal(hasDbPathArg(args), true);
  assert.equal(result.includes('--db-path'), false);
  assert.deepEqual(result.slice(-2), args);
});

test('the default loopback API host remains available to the Vite proxy', () => {
  assert.deepEqual(getCliDevHosts([]), {
    host: '127.0.0.1',
    proxyHost: '127.0.0.1',
  });
});

test('an explicit network host is used by the local backend proxy', () => {
  assert.deepEqual(getCliDevHosts(['--host', '192.0.2.10']), {
    host: '192.0.2.10',
    proxyHost: '192.0.2.10',
  });
});

test('wildcard binds use loopback only for the local backend proxy', () => {
  assert.deepEqual(getCliDevHosts(['--host', '0.0.0.0']), {
    host: '0.0.0.0',
    proxyHost: 'localhost',
  });
});
