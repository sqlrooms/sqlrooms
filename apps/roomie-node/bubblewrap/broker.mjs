import http from 'node:http';
import net from 'node:net';

/** Per-run transport only: exact MCP target and administrator-selected model origins. */
export async function createBroker({
  socketPath,
  mcpUrl,
  token,
  modelOrigins,
  ready = () => false,
}) {
  const target = new URL(mcpUrl);
  const origins = (
    modelOrigins ?? ['https://api.openai.com', 'https://api.anthropic.com']
  ).map((value) => {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== value ||
      url.username ||
      url.password
    )
      throw Error('Model origins must be exact HTTP(S) origins.');
    return url;
  });
  const sockets = new Set();
  const track = (socket) => {
    sockets.add(socket);
    socket.on('error', () => socket.destroy());
    socket.once('close', () => sockets.delete(socket));
    socket.setTimeout(65000, () => socket.destroy());
    return socket;
  };
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/__roomie_ready') {
      response.writeHead(ready() ? 204 : 503).end();
      return;
    }
    // No owner API, arbitrary forward proxy, redirects, or agent-selected MCP destination.
    let destination;
    if (
      ['/mcp', 'http://127.0.0.1:43100/mcp'].includes(request.url) &&
      ['POST', 'GET', 'DELETE'].includes(request.method)
    )
      destination = target;
    else {
      try {
        const url = new URL(request.url);
        if (
          url.protocol === 'http:' &&
          !url.username &&
          !url.password &&
          origins.some((o) => o.origin === url.origin)
        )
          destination = url;
      } catch {
        /* reject below */
      }
    }
    if (!destination) {
      response.writeHead(403).end();
      return;
    }
    const mcp = destination === target;
    const headers = {...request.headers, host: destination.host};
    delete headers['proxy-authorization'];
    delete headers['proxy-connection'];
    if (mcp) headers.authorization = `Bearer ${token}`;
    const upstream = http.request(
      destination,
      {method: request.method, headers, timeout: 65000},
      (reply) => {
        response.writeHead(reply.statusCode, reply.headers);
        reply.pipe(response);
      },
    );
    upstream.on('socket', track);
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => upstream.destroy());
    let bytes = 0;
    request.on('data', (chunk) => {
      if ((bytes += chunk.length) > 2 * 1024 * 1024) {
        upstream.destroy();
        request.destroy();
      }
    });
    request.pipe(upstream);
  });
  server.on('connection', track);
  server.maxConnections = 64;
  server.headersTimeout = 10000;
  server.requestTimeout = 65000;
  server.on('connect', (request, client, head) => {
    const origin = origins.find(
      (url) =>
        url.protocol === 'https:' &&
        request.url === `${url.hostname}:${url.port || '443'}`,
    );
    if (!origin) {
      client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const upstream = track(
      net.connect({host: origin.hostname, port: Number(origin.port || 443)}),
    );
    upstream.once('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(client).pipe(upstream);
    });
    client.once('close', () => upstream.destroy());
    upstream.once('close', () => client.destroy());
  });
  server.on('clientError', (_error, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });
  return async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  };
}
