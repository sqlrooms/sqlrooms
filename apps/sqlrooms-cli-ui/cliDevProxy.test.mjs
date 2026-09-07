import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer as createHttpServer} from 'node:http';
import {once} from 'node:events';
import test from 'node:test';
import {createServer as createViteServer} from 'vite';

import {createCliDevProxy} from './cliDevProxy.mjs';

test('the CLI WebSocket proxy forwards upgrade requests', async (t) => {
  let upgradePath;
  const upstreamSockets = new Set();
  const upstream = createHttpServer();
  upstream.on('upgrade', (request, socket) => {
    upgradePath = request.url;
    upstreamSockets.add(socket);
    socket.on('close', () => upstreamSockets.delete(socket));
    const accept = createHash('sha1')
      .update(
        `${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
      )
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const upstreamAddress = upstream.address();
  assert.notEqual(upstreamAddress, null);
  assert.equal(typeof upstreamAddress, 'object');

  const vite = await createViteServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: createCliDevProxy(`http://127.0.0.1:${upstreamAddress.port}`),
    },
  });
  await vite.listen();
  const viteAddress = vite.httpServer?.address();
  assert.notEqual(viteAddress, null);
  assert.equal(typeof viteAddress, 'object');

  t.after(async () => {
    for (const socket of upstreamSockets) socket.destroy();
    await vite.close();
    await new Promise((resolve, reject) => {
      upstream.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const socket = new WebSocket(`ws://127.0.0.1:${viteAddress.port}/ws/duckdb`);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('WebSocket proxy timed out')),
      5_000,
    );
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      {once: true},
    );
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket proxy failed'));
      },
      {once: true},
    );
  });

  assert.equal(upgradePath, '/ws/duckdb');
  socket.close();
});
