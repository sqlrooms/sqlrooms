import assert from 'node:assert/strict';
import test from 'node:test';

import {getPythonCliDevArgs, hasDbPathArg} from './cli-dev-args.mjs';

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

test('the default external URL preserves the selected public host', () => {
  const result = getPythonCliDevArgs(
    ['--host', '192.0.2.10'],
    4273,
    3100,
    '192.0.2.10',
    {externalUrl: undefined},
  );
  const externalUrlIndex = result.indexOf('--external-url');

  assert.equal(result[externalUrlIndex + 1], 'http://192.0.2.10:3100');
});
