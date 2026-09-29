import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {createCliCapabilityRuntime} from '../../createCliCapabilityRuntime';

/** Real local MCP transport around the shared CLI runtime; owns no operations. */
export async function startEvalMcpHost(
  runtime: ReturnType<typeof createCliCapabilityRuntime>,
  onRequest: (method: string, input?: unknown) => void = () => {},
) {
  const token = randomBytes(32).toString('hex');
  const sessions = new Set<Server>();
  const pending = new Set<Promise<unknown>>();
  const http = createServer(async (request, response) => {
    if (
      request.url !== '/mcp' ||
      request.headers.origin !== undefined ||
      request.headers.host !==
        `127.0.0.1:${(http.address() as import('node:net').AddressInfo).port}` ||
      request.headers.authorization !== `Bearer ${token}`
    ) {
      response.writeHead(403).end();
      return;
    }
    // Each HTTP request has an SDK server/transport in stateless mode; the
    // authoritative domain workspace and invocation queue are shared.
    const server = new Server(
      {name: 'sqlrooms-isolated-eval', version: '1.0.0'},
      {capabilities: {tools: {}}},
    );
    sessions.add(server);
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      onRequest('tools/list');
      return {tools: runtime.listTools()};
    });
    server.setRequestHandler(CallToolRequestSchema, async (call, extra) => {
      onRequest(`tools/call:${call.params.name}`, {
        requestId: extra.requestId,
        ...call.params,
      });
      const invocation = runtime.callTool(
        call.params.name,
        call.params.arguments ?? {},
        {
          surface: 'mcp-http',
          actor: 'external-eval',
          requestId: String(extra.requestId),
          signal: extra.signal,
          clientInfo: server.getClientVersion(),
        },
      );
      pending.add(invocation);
      try {
        const result = await invocation;
        return {
          content: [{type: 'text' as const, text: JSON.stringify(result)}],
          structuredContent: result,
          isError: !result.ok,
        };
      } finally {
        pending.delete(invocation);
      }
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      sessions.delete(server);
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) response.writeHead(500).end();
      else response.end();
      console.error('MCP transport failed:', error);
    }
  });
  http.requestTimeout = 35_000;
  http.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(0, '127.0.0.1', resolve);
  });
  let url: string;
  let credentialDirectory: string | undefined;
  let credentialFile: string;
  try {
    const address = http.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing MCP address.');
    if (process.platform === 'win32')
      throw new Error(
        'Private credential ACLs are not yet verified on Windows.',
      );
    url = `http://127.0.0.1:${address.port}/mcp`;
    credentialDirectory = await mkdtemp(
      path.join(tmpdir(), 'sqlrooms-eval-auth-'),
    );
    credentialFile = path.join(credentialDirectory, 'credential.json');
    await writeFile(credentialFile, JSON.stringify({token, mcpUrl: url}), {
      mode: 0o600,
    });
  } catch (error) {
    // The caller receives no disposal handle, so release what setup acquired.
    if (credentialDirectory)
      await rm(credentialDirectory, {recursive: true, force: true});
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    throw error;
  }
  const createdCredentialDirectory = credentialDirectory;
  let disposed = false;
  return {
    url,
    token,
    credentialFile,
    async dispose() {
      if (disposed) return;
      disposed = true;
      await rm(createdCredentialDirectory, {recursive: true, force: true});
      runtime.dispose();
      await Promise.allSettled([...sessions].map((server) => server.close()));
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
      await Promise.allSettled(pending);
      await runtime.drain();
    },
  };
}
