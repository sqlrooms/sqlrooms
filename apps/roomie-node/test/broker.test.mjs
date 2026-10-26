import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBroker} from '../bubblewrap/broker.mjs';

test('broker exposes only the exact scoped MCP path and configured model origin', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'rb-'));
  const socketPath = join(directory, 's');
  const seen = [];
  const upstream = http.createServer((req, res) => {
    seen.push({
      path: req.url,
      auth: req.headers.authorization,
      host: req.headers.host,
    });
    res.end('ok');
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const close = await createBroker({
    socketPath,
    mcpUrl: origin + '/mcp',
    token: 'scoped-canary',
    modelOrigins: [origin],
  });
  t.after(async () => {
    await close();
    upstream.closeAllConnections();
    await new Promise((r) => upstream.close(r));
    await rm(directory, {recursive: true, force: true});
  });
  const request = (path, method = 'POST') =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath,
          path,
          method,
          headers: {authorization: 'owner-impersonation', host: 'bad-host'},
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        },
      );
      req.on('error', reject);
      req.end();
    });
  assert.equal(await request('/mcp'), 200);
  assert.deepEqual(seen[0], {
    path: '/mcp',
    auth: 'Bearer scoped-canary',
    host: new URL(origin).host,
  });
  for (const path of [
    '/api/auth/ticket',
    '/api/approvals',
    '/mcp?x=1',
    'http://169.254.169.254/',
    'http://127.0.0.1:1/mcp',
  ])
    assert.equal(await request(path), 403);
  assert.equal(await request('/mcp', 'PUT'), 403);
  assert.equal(await request(origin + '/v1/responses'), 200);
  assert.equal(await request('http://user@' + new URL(origin).host + '/'), 403);
  const connect = await new Promise((resolve, reject) => {
    const req = http.request({
      socketPath,
      method: 'CONNECT',
      path: '127.0.0.1:1',
    });
    req.on('connect', (res, socket) => {
      socket.destroy();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(connect, 403);
});

test('broker CONNECT permits only the configured TLS authority and closes tunnels', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'rb-'));
  const socketPath = join(directory, 's');
  const echo = net.createServer((socket) => socket.pipe(socket));
  await new Promise((r) => echo.listen(0, '127.0.0.1', r));
  const authority = `127.0.0.1:${echo.address().port}`;
  const close = await createBroker({
    socketPath,
    mcpUrl: 'http://127.0.0.1:1/mcp',
    token: 'scoped',
    modelOrigins: ['https://' + authority],
  });
  t.after(async () => {
    await close();
    await new Promise((r) => echo.close(r));
    await rm(directory, {recursive: true, force: true});
  });
  const socket = await new Promise((resolve, reject) => {
    const req = http.request({socketPath, method: 'CONNECT', path: authority});
    req.once('connect', (res, socket) => {
      assert.equal(res.statusCode, 200);
      resolve(socket);
    });
    req.once('error', reject);
    req.end();
  });
  const reply = new Promise((resolve) => socket.once('data', resolve));
  socket.write('tls-canary');
  assert.equal((await reply).toString(), 'tls-canary');
  socket.destroy();
});
