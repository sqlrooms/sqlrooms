import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  getForwardedCliArgs,
  getCliDevHosts,
  getPythonCliDevArgs,
  hasDbPathArg,
  readOptionValue,
} from './cli-dev-args.mjs';

test('the direct root launcher preserves the end-of-options marker', () => {
  assert.deepEqual(getForwardedCliArgs(['--dry', '--', '-dev.db']), [
    '--',
    '-dev.db',
  ]);
});

test('the package script drops its separator and preserves the user marker', () => {
  assert.deepEqual(
    getForwardedCliArgs(['--dry', '--', '--port', '4274'], {
      stripScriptSeparator: true,
    }),
    ['--port', '4274'],
  );
  assert.deepEqual(
    getForwardedCliArgs(['--dry', '--', '--', '-dev.db'], {
      stripScriptSeparator: true,
    }),
    ['--', '-dev.db'],
  );
});

test('option parsing stops at the end-of-options marker', () => {
  assert.equal(
    readOptionValue(
      ['--port', '4273', '--', '--port', 'database.db'],
      '--port',
    ),
    '4273',
  );
  assert.equal(
    readOptionValue(['--', '--port', 'database.db'], '--port'),
    null,
  );
  assert.equal(
    readOptionValue(
      ['--', '--external-ws-url=wss://example.test/ws/duckdb'],
      '--external-ws-url',
    ),
    null,
  );
});

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

test('development external URL precedence is CLI, environment, then Vite default', () => {
  const options = {externalUrl: 'https://environment.example/sqlrooms'};
  for (const args of [
    ['--external-url', 'https://flag.example'],
    ['--external-url=https://flag.example'],
  ]) {
    assert.equal(
      readOptionValue(
        getPythonCliDevArgs(args, 4273, 3100, options),
        '--external-url',
      ),
      'https://flag.example',
    );
  }
  assert.equal(
    readOptionValue(
      getPythonCliDevArgs([], 4273, 3100, options),
      '--external-url',
    ),
    null,
  );
  for (const externalUrl of ['', null]) {
    assert.equal(
      readOptionValue(
        getPythonCliDevArgs([], 4273, 3100, {externalUrl}),
        '--external-url',
      ),
      'http://localhost:3100',
    );
  }
});

test('the combined dev launcher does not override environment HTTP and WS URLs', () => {
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./dev.mjs', import.meta.url)), 'cli', '--dry'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SQLROOMS_EXTERNAL_URL: 'https://environment.example/sqlrooms',
        SQLROOMS_EXTERNAL_WS_URL:
          'wss://environment.example/sqlrooms/ws/duckdb',
      },
    },
  );
  const match = output.match(/SQLROOMS_CLI_DEV_ARGS=(\[.*\]) node/);
  assert.ok(match, output);
  assert.equal(readOptionValue(JSON.parse(match[1]), '--external-url'), null);
  assert.match(output, /VITE_SQLROOMS_CLI_PROXY_WEBSOCKETS=true/);
});

test('a dash-prefixed database path after -- is preserved', () => {
  const args = ['--', '-dev.db'];
  const result = getPythonCliDevArgs(args, 4273, 3100);

  assert.equal(hasDbPathArg(args), true);
  assert.equal(result.includes('--db-path'), false);
  assert.deepEqual(result.slice(-2), args);
});

test('an explicit WebSocket URL cannot disable the authenticated dev proxy', () => {
  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('./dev.mjs', import.meta.url)),
      'cli',
      '--dry',
      '--external-ws-url=ws://localhost:3100/ws/duckdb',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        SQLROOMS_EXTERNAL_WS_URL: 'ws://localhost:3100/ws/duckdb',
      },
    },
  );
  assert.match(output, /VITE_SQLROOMS_CLI_PROXY_WEBSOCKETS=true/);
  assert.match(output, /--external-ws-url=ws:\/\/localhost:3100\/ws\/duckdb/);
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
