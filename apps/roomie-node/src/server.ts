import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {RoomCapabilityPolicy} from '@sqlrooms/mcp';
import {createWorkspaceAccess, accessDenied} from './access';
import {writeCredentialFile} from './credentials';
import {createWorkspaceMcpRuntime} from './mcp';
import type {openWorkspace} from './workspace';

/** Start a loopback-only MCP endpoint for an already recovered workspace. */
export async function startWorkspaceServer(options: {
  workspace: Awaited<ReturnType<typeof openWorkspace>>;
  port?: number;
  /** Additional host policy can deny calls; it cannot grant missing credentials. */
  policy?: RoomCapabilityPolicy;
}) {
  const access = createWorkspaceAccess();
  const runtime = createWorkspaceMcpRuntime(options.workspace, options.policy);
  let origin = '';
  let closing = false;
  let disposal: Promise<void> | undefined;
  const active = new Set<Promise<void>>();
  const server = createServer(
    {requestTimeout: 10_000, headersTimeout: 10_000},
    (request, response) => {
      const work = handle(request, response).catch(() => {
        if (!response.headersSent)
          json(response, 500, {error: 'internal_error'});
        else response.end();
      });
      active.add(work);
      void work.finally(() => active.delete(work));
    },
  );
  let credential: Awaited<ReturnType<typeof writeCredentialFile>> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing listener address.');
    origin = `http://127.0.0.1:${address.port}`;
    credential = await writeCredentialFile({
      token: access.ownerToken,
      binding: access.binding,
      apiUrl: origin,
      mcpUrl: `${origin}/mcp`,
    });
  } catch (error) {
    access.close();
    runtime.dispose();
    server.close();
    server.closeAllConnections();
    await credential?.close();
    throw error;
  }
  return {
    url: origin,
    mcpUrl: `${origin}/mcp`,
    binding: access.binding,
    credentialPath: credential.path,
    /** Stop admission, drain real commands, and remove the private handoff. Caller owns the workspace. */
    dispose() {
      if (disposal) return disposal;
      closing = true;
      access.close();
      runtime.dispose();
      disposal = (async () => {
        const stopped = new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        // Closing sockets does not cancel an accepted durable mutation.
        server.closeAllConnections();
        try {
          await Promise.allSettled([...active]);
          await runtime.drain();
          await options.workspace.flush();
        } finally {
          await credential!.close();
          await stopped;
        }
      })();
      return disposal;
    },
  };

  async function handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      if (closing) {
        json(response, 503, {error: 'workspace_closing'});
        return;
      }
      // Exact authorities prevent DNS rebinding. Forwarded headers never establish trust.
      if (
        request.headers.host !== new URL(origin).host ||
        (request.headers.origin !== undefined &&
          request.headers.origin !== origin)
      )
        throw accessDenied('forbidden');
      const path = request.url;
      const authorization = request.headers.authorization ?? '';
      const token = authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7)
        : String(request.headers['x-sqlrooms-token'] ?? '');
      if (path === '/auth.json' && request.method === 'GET') {
        json(response, 200, {binding: access.binding});
        return;
      }
      if (path === '/api/auth/ticket' && request.method === 'POST') {
        access.verify(token, 'bootstrap');
        json(response, 200, {
          url: `${origin}/#sqlrooms-ticket=${access.ticket()}`,
        });
        return;
      }
      if (path === '/api/auth/exchange' && request.method === 'POST') {
        const body = await readJson(request, 4096);
        if (
          !body ||
          typeof body !== 'object' ||
          !('ticket' in body) ||
          typeof body.ticket !== 'string'
        )
          throw accessDenied();
        json(response, 200, access.redeem(body.ticket));
        return;
      }
      if (path === '/api/auth/renew' && request.method === 'POST') {
        json(response, 200, access.renew(token));
        return;
      }
      if (path !== '/mcp') {
        json(response, 404, {error: 'not_found'});
        return;
      }
      access.verify(token, 'mcp');
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        json(response, 405, {error: 'method_not_allowed'});
        return;
      }
      const body = await readJson(request, 256 * 1024);
      // Stateless SDK instances prevent session IDs from becoming ambient authority.
      const mcp = new Server(
        {name: 'Roomie Node', version: '0.0.0'},
        {
          capabilities: {
            tools: {},
            experimental: {'sqlrooms/durable-content-v1': {}},
          },
          instructions:
            'Content commands only. Writes require commit.operationId and, for existing documents, commit.artifactId and commit.expectedRevision in execute_command arguments. Read a document to obtain its committed revision. Retry uncertain writes with the same operation ID and input. Browser SQL/Arrow, runs and approvals are not available.',
        },
      );
      mcp.setRequestHandler(ListToolsRequestSchema, async () => {
        access.verify(token, 'mcp');
        return {tools: runtime.listTools()};
      });
      mcp.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
        const caller = access.verify(token, 'mcp');
        const result = await runtime.callTool(
          request.params.name,
          request.params.arguments ?? {},
          {
            surface: 'mcp-http',
            actor: caller.principalId,
            requestId: String(extra.requestId),
            traceId: String(extra.requestId),
            metadata: request.params._meta,
          },
        );
        return {
          content: [{type: 'text', text: JSON.stringify(result)}],
          structuredContent: result,
          isError: !result.ok,
        };
      });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      try {
        await mcp.connect(transport);
        await transport.handleRequest(request, response, body);
      } finally {
        await mcp.close();
      }
    } catch (error) {
      const failure = error as {status?: number; code?: string};
      json(response, failure.status ?? 500, {
        error: failure.code ?? 'internal_error',
      });
    }
  }
}

function json(response: ServerResponse, status: number, value: unknown) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(value));
}

async function readJson(
  request: IncomingMessage,
  maximum: number,
): Promise<unknown> {
  if (
    request.headers['content-type']?.split(';')[0]?.trim() !==
    'application/json'
  )
    throw Object.assign(new Error('JSON required.'), {
      status: 415,
      code: 'unsupported_media_type',
    });
  // Do not destroy the socket before returning a bounded error response.
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request.iterator({destroyOnReturn: false})) {
    bytes += chunk.length;
    if (bytes > maximum)
      throw Object.assign(new Error('Body too large.'), {
        status: 413,
        code: 'body_too_large',
      });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), {
      status: 400,
      code: 'invalid_json',
    });
  }
}
