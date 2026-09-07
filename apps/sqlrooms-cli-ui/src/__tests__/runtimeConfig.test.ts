import {describe, expect, test} from '@jest/globals';
import {resolveCliDevProxyConfig} from '../runtimeConfig';

describe('resolveCliDevProxyConfig', () => {
  test('uses the browser origin for wildcard-host development proxies', () => {
    expect(
      resolveCliDevProxyConfig(
        {
          wsUrl: 'ws://localhost:4273/ws/duckdb',
          crdtWsUrl: 'ws://localhost:4273/ws/duckdb',
          apiBaseUrl: '',
          mcp: {
            enabled: true,
            url: 'http://127.0.0.1:42100/mcp',
            bridgeUrl: 'ws://localhost:4273/ws/mcp-bridge',
          },
        },
        'http://192.0.2.10:3100/workspace',
        {proxyWebSockets: true},
      ),
    ).toMatchObject({
      wsUrl: 'ws://192.0.2.10:3100/ws/duckdb',
      crdtWsUrl: 'ws://192.0.2.10:3100/ws/duckdb',
      apiBaseUrl: '',
      mcp: {
        url: 'http://127.0.0.1:42100/mcp',
        bridgeUrl: 'ws://192.0.2.10:3100/ws/mcp-bridge',
      },
    });
  });

  test('uses secure WebSockets for an HTTPS development page', () => {
    expect(
      resolveCliDevProxyConfig({}, 'https://dev.example.test:3100', {
        proxyWebSockets: true,
      }),
    ).toMatchObject({
      wsUrl: 'wss://dev.example.test:3100/ws/duckdb',
      crdtWsUrl: 'wss://dev.example.test:3100/ws/duckdb',
    });
  });

  test('preserves explicitly configured external URLs', () => {
    const config = {
      apiBaseUrl: 'https://tunnel.example.test',
      wsUrl: 'wss://tunnel.example.test/ws/duckdb',
    };

    expect(resolveCliDevProxyConfig(config, 'http://localhost:3100')).toBe(
      config,
    );
  });

  test('preserves an explicit external WebSocket URL', () => {
    const config = {
      apiBaseUrl: '',
      wsUrl: 'wss://tunnel.example.test/ws/duckdb',
      crdtWsUrl: 'wss://tunnel.example.test/ws/duckdb',
    };

    expect(
      resolveCliDevProxyConfig(config, 'http://localhost:3100'),
    ).toMatchObject(config);
  });
});
