import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCliDevHosts,
  getPythonCliDevArgs,
  hasDbPathArg,
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
    const result = getPythonCliDevArgs(args, 4273, 3100, 'localhost', {
      externalUrl: undefined,
    });
    assert.notEqual(result.indexOf('--db-path'), -1, args.join(' '));
  }
});

test('a dash-prefixed database path after -- is preserved', () => {
  const args = ['--', '-dev.db'];
  const result = getPythonCliDevArgs(args, 4273, 3100, 'localhost', {
    externalUrl: null,
  });

  assert.equal(hasDbPathArg(args), true);
  assert.equal(result.includes('--db-path'), false);
  assert.deepEqual(result.slice(-2), args);
});

test('the default external URL preserves the selected public host', () => {
  const result = getPythonCliDevArgs(
    ['--host', '192.0.2.10'],
    4273,
    3100,
    '192.0.2.10',
    {externalUrl: null},
  );
  const externalUrlIndex = result.indexOf('--external-url');

  assert.equal(result[externalUrlIndex + 1], 'http://192.0.2.10:3100');
});

test('the default loopback API host uses the documented localhost UI origin', () => {
  assert.deepEqual(getCliDevHosts([]), {
    host: '127.0.0.1',
    proxyHost: '127.0.0.1',
    externalHost: 'localhost',
  });
});

test('an explicit network host remains browser-visible', () => {
  assert.deepEqual(getCliDevHosts(['--host', '192.0.2.10']), {
    host: '192.0.2.10',
    proxyHost: '192.0.2.10',
    externalHost: '192.0.2.10',
  });
});
