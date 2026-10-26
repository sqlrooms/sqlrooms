import {withExecutionLease, type ExecutionLifecycle} from './lifecycle';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {HarnessStartTurn, HarnessApprovalDecision} from '@sqlrooms/ai-config';
import {createSupervisor} from './supervisor';
import {
  recoverIsolatedHarnesses,
  type HarnessIsolation,
} from './harnessIsolation';
import {attachWorkspaceSockets} from './sockets';
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
  /** Optional deployment owner; browser connections themselves never hold a lease. */
  lifecycle?: ExecutionLifecycle;
  /** Exact HTTPS browser origin behind a trusted deployment proxy. Local MCP remains loopback. */
  publicOrigin?: string;
  /** Dedicated browser ingress behind an authenticated private gateway. All local processes
   * outside Bubblewrap are trusted administrators. Every upstream-authorized admin is the
   * workspace owner. Only default model origins are allowed. Never expose this listener publicly. */
  trustedGateway?: {port: number};
  /** Built Roomie UI directory; root serves the document-read-only node.html entry. */
  uiDirectory?: string;
  /** Explicit trusted-local mode or an enforced container boundary. */
  harness?: {
    trustedLocal?: true;
    /** Required for enforced isolation; never falls back to trusted-local execution. */
    isolation?: HarnessIsolation;
    /** Native harness used for new turns; defaults to Codex. */
    adapter?: 'codex' | 'claude';
    executable?: string;
    model?: string;
    deadlineMs?: number;
  };
  /** Additional host policy can deny calls; it cannot grant missing credentials. */
  policy?: RoomCapabilityPolicy;
}) {
  if (
    options.harness &&
    Boolean(options.harness.trustedLocal) === Boolean(options.harness.isolation)
  )
    throw new Error(
      'Choose exactly one harness mode: trustedLocal or isolation.',
    );
  const publicOrigin = options.publicOrigin;
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (
      url.protocol !== 'https:' ||
      url.origin !== publicOrigin ||
      url.username ||
      url.password
    )
      throw new Error('publicOrigin must be an exact HTTPS origin.');
  }
  if (
    options.trustedGateway &&
    (!publicOrigin ||
      !Number.isInteger(options.trustedGateway.port) ||
      options.trustedGateway.port < 0 ||
      options.trustedGateway.port > 65535 ||
      (options.harness &&
        (options.harness.isolation?.backend !== 'bubblewrap' ||
          options.harness.isolation.modelOrigins !== undefined)))
  )
    throw Error(
      'Trusted gateway requires an exact HTTPS origin and a private-network Bubblewrap harness with default model origins (or no harness).',
    );
  if (options.harness?.isolation)
    await recoverIsolatedHarnesses(
      options.workspace.directory,
      options.harness.isolation,
    );
  const access = createWorkspaceAccess();
  const runtime = createWorkspaceMcpRuntime(options.workspace, options.policy);
  let origin = '';
  let closing = false;
  let receivingUploads = 0;
  let disposal: Promise<void> | undefined;
  const active = new Set<Promise<void>>();
  function listener(gateway: boolean) {
    const http = createServer(
      {requestTimeout: 10_000, headersTimeout: 10_000},
      (request, response) => {
        const work = withExecutionLease(options.lifecycle, 'request', () =>
          handle(request, response, gateway),
        ).catch(() => {
          if (!response.headersSent)
            json(response, 500, {error: 'internal_error'});
          else response.end();
        });
        active.add(work);
        void work.finally(() => active.delete(work));
      },
    );
    const sockets = attachWorkspaceSockets(http, {
      workspace: options.workspace,
      access,
      origin: () => origin,
      publicOrigin,
      lifecycle: options.lifecycle,
    });
    return {http, sockets};
  }
  const internal = listener(false);
  const gateway = options.trustedGateway ? listener(true) : undefined;
  const listeners = [internal, ...(gateway ? [gateway] : [])];
  const server = internal.http;
  let gatewayUrl: string | undefined;
  let supervisor: ReturnType<typeof createSupervisor> | undefined;
  const runSignals = new Map<string, AbortController>();
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
    if (gateway) {
      await new Promise<void>((resolve, reject) => {
        gateway.http.once('error', reject);
        gateway.http.listen(options.trustedGateway!.port, '127.0.0.1', () => {
          gateway.http.off('error', reject);
          resolve();
        });
      });
      const address = gateway.http.address();
      if (!address || typeof address === 'string')
        throw Error('Missing gateway listener.');
      gatewayUrl = `http://127.0.0.1:${address.port}`;
    }
    if (options.harness)
      supervisor = createSupervisor({
        workspace: options.workspace,
        mcpUrl: `${origin}/mcp`,
        ...options.harness,
        lifecycle: options.lifecycle,
        drain: () => runtime.drain(),
        credentials: {
          issue: () => {
            const token = access.issueHarness();
            runSignals.set(token, new AbortController());
            return token;
          },
          revoke: (token) => {
            access.revoke(token);
            runSignals.get(token)?.abort();
            runSignals.delete(token);
          },
        },
      });
    credential = await writeCredentialFile({
      token: access.ownerToken,
      binding: access.binding,
      apiUrl: origin,
      mcpUrl: `${origin}/mcp`,
    });
  } catch (error) {
    access.close();
    runtime.dispose();
    await supervisor?.dispose();
    for (const {http, sockets} of listeners) {
      await sockets.dispose();
      http.close();
      http.closeAllConnections();
    }
    await credential?.close();
    throw error;
  }
  return {
    url: origin,
    /** Local deployment address, never a credential or proof of gateway identity. */
    gatewayUrl,
    mcpUrl: `${origin}/mcp`,
    binding: access.binding,
    credentialPath: credential.path,
    /** Stop admission, drain real commands, and remove the private handoff. Caller owns the workspace. */
    dispose() {
      if (disposal) return disposal;
      closing = true;
      access.close();
      runtime.dispose();
      disposal = withExecutionLease(options.lifecycle, 'shutdown', async () => {
        const stopped = Promise.all(
          listeners.map(
            ({http}) =>
              new Promise<void>((resolve, reject) =>
                http.close((error) => (error ? reject(error) : resolve())),
              ),
          ),
        );
        // Closing sockets does not cancel an accepted durable mutation.
        for (const {http} of listeners) http.closeAllConnections();
        try {
          try {
            await supervisor?.dispose();
          } finally {
            await Promise.all(listeners.map(({sockets}) => sockets.dispose()));
          }
          await Promise.allSettled([...active]);
          await runtime.drain();
          await options.workspace.flush();
        } finally {
          await credential!.close();
          await stopped;
        }
      });
      return disposal;
    },
  };

  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
    fromGateway: boolean,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      if (closing) {
        json(response, 503, {error: 'workspace_closing'});
        return;
      }
      // Exact authorities prevent DNS rebinding. Forwarded headers never establish trust.
      if (
        ![
          new URL(origin).host,
          ...(publicOrigin ? [new URL(publicOrigin).host] : []),
        ].includes(request.headers.host ?? '') ||
        (request.headers.origin !== undefined &&
          request.headers.origin !== origin &&
          request.headers.origin !== publicOrigin)
      )
        throw accessDenied('forbidden');
      const path = request.url;
      if (
        options.uiDirectory &&
        request.method === 'GET' &&
        (path === '/' || path === '/node.html' || path?.startsWith('/assets/'))
      ) {
        const root = resolve(options.uiDirectory);
        const file = resolve(root, path === '/' ? 'node.html' : '.' + path!);
        if (!file.startsWith(root + sep)) throw accessDenied('forbidden');
        const types: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.wasm': 'application/wasm',
          '.woff2': 'font/woff2',
        };
        if (!types[extname(file)]) throw accessDenied('forbidden');
        try {
          const bytes = await readFile(file);
          response.setHeader('Content-Type', types[extname(file)]!);
          response.end(bytes);
        } catch {
          json(response, 404, {error: 'not_found'});
        }
        return;
      }
      const authorization = request.headers.authorization ?? '';
      const token = authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7)
        : String(request.headers['x-sqlrooms-token'] ?? '');
      if (path === '/auth.json' && request.method === 'GET') {
        json(response, 200, {
          binding: access.binding,
          ...(fromGateway ? {browserAuth: 'trusted-gateway'} : {}),
        });
        return;
      }
      if (path === '/api/auth/gateway') {
        // Listener identity is established by the host, never by forwarded headers.
        // Origin/content type are CSRF protection, not authentication of local callers.
        if (
          !fromGateway ||
          request.method !== 'POST' ||
          request.headers.host !== new URL(publicOrigin!).host ||
          request.headers.origin !== publicOrigin ||
          request.headers['content-type']?.split(';')[0].trim() !==
            'application/json' ||
          (request.headers['sec-fetch-site'] !== undefined &&
            request.headers['sec-fetch-site'] !== 'same-origin')
        )
          throw accessDenied('forbidden');
        await readJson(request, 4096);
        json(response, 200, access.issueBrowser());
        return;
      }
      if (path === '/api/auth/ticket' && request.method === 'POST') {
        access.verify(token, 'bootstrap');
        json(response, 200, {
          url: `${publicOrigin ?? origin}/#sqlrooms-ticket=${access.ticket()}`,
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
      if (
        path?.startsWith('/api/runs') ||
        path?.startsWith('/api/conversations') ||
        path?.startsWith('/api/approvals') ||
        path?.startsWith('/api/run-blobs')
      ) {
        const caller = access.verify(token, 'runs');
        const url = new URL(path, origin);
        const log = options.workspace.runs;
        if (request.method === 'GET' && url.pathname === '/api/approvals') {
          access.verify(token, 'runs');
          json(
            response,
            200,
            log.pending().map((approval) => ({
              ...approval,
              conversationId: log.get(approval.runId).conversationId,
            })),
          );
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/conversations') {
          json(response, 200, log.conversations());
          return;
        }
        if (
          request.method === 'GET' &&
          url.pathname === '/api/conversations/snapshot'
        ) {
          json(
            response,
            200,
            log.snapshot(z.string().min(1).parse(url.searchParams.get('id'))),
          );
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/runs/events') {
          json(
            response,
            200,
            log.events(
              Number(url.searchParams.get('after') ?? 0),
              500,
              url.searchParams.get('conversationId') ?? undefined,
            ),
          );
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/run-blobs') {
          json(response, 200, {
            content: log.blob(
              z.string().min(1).parse(url.searchParams.get('id')),
            ),
          });
          return;
        }
        if (!supervisor) {
          json(response, 503, {error: 'harness_disabled'});
          return;
        }
        if (request.method === 'POST' && path === '/api/runs/start') {
          const input = HarnessStartTurn.parse(await readJson(request, 65536));
          json(response, 200, supervisor.start(input, caller.principalId));
          return;
        }
        if (request.method === 'POST' && path === '/api/runs/cancel') {
          const input = z
            .strictObject({runId: z.string()})
            .parse(await readJson(request, 4096));
          json(response, 200, await supervisor.cancel(input.runId));
          return;
        }
        if (request.method === 'POST' && path === '/api/approvals/resolve') {
          const input = HarnessApprovalDecision.parse(
            await readJson(request, 4096),
          );
          json(
            response,
            200,
            supervisor.resolve(
              input.approvalId,
              input.decision,
              caller.principalId,
            ),
          );
          return;
        }
        json(response, 400, {error: 'unsupported_run_operation'});
        return;
      }
      if (path === '/api/refresh' && request.method === 'POST') {
        access.verify(token, 'edit');
        await options.workspace.refresh();
        json(response, 200, {ok: true});
        return;
      }
      if (path?.startsWith('/api/upload?') && request.method === 'POST') {
        access.verify(token, 'edit');
        if (receivingUploads >= 2) {
          response.setHeader('Connection', 'close');
          json(response, 429, {error: 'upload_capacity'});
          return;
        }
        receivingUploads++;
        try {
          const url = new URL(path, origin);
          const format = z
            .enum(['csv', 'json', 'parquet', 'arrow'])
            .parse(url.searchParams.get('format'));
          let size = 0;
          const chunks: Buffer[] = [];
          for await (const chunk of request.iterator({
            destroyOnReturn: false,
          })) {
            size += chunk.length;
            if (size > 32 * 1024 * 1024) {
              json(response, 413, {error: 'upload_too_large'});
              return;
            }
            chunks.push(chunk);
          }
          const receipt = await options.workspace.upload(
            {
              operationId: z
                .string()
                .parse(request.headers['x-roomie-operation']),
              tableName: z.string().parse(url.searchParams.get('table')),
              format,
            },
            Buffer.concat(chunks),
          );
          json(response, 200, receipt);
          return;
        } finally {
          receivingUploads--;
        }
      }
      if (path === '/api/commands' && request.method === 'POST') {
        const caller = access.verify(token, 'edit');
        const body = z
          .strictObject({
            commandId: z.string().min(1),
            input: z.record(z.string(), z.json()).default({}),
            commit: z.strictObject({
              operationId: z.string().min(1).max(200),
              artifactId: z.string().min(1).optional(),
              expectedRevision: z.number().int().nonnegative().optional(),
            }),
          })
          .parse(await readJson(request, 256 * 1024));
        // The same runtime enforces command policy, revision checks and receipts
        // for browser and harness callers. No browser projection is trusted.
        const result = await runtime.callTool('execute_command', body, {
          surface: 'mcp-http',
          actor: caller.principalId,
        });
        json(
          response,
          result.ok ? 200 : result.code === 'revision-conflict' ? 409 : 400,
          result,
        );
        return;
      }
      if (path === '/api/catalog' && request.method === 'GET') {
        access.verify(token, 'view');
        json(response, 200, options.workspace.catalog());
        return;
      }
      if (path === '/api/content' && request.method === 'GET') {
        access.verify(token, 'view');
        const snapshot = await options.workspace.snapshot();
        json(response, 200, {
          workspaceId: options.workspace.workspaceId,
          sequence: snapshot.sequence,
          content: snapshot.content,
          revisions: snapshot.revisions,
          readOnly: true,
        });
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
            'Content commands only. Writes require commit.operationId and, for existing documents, commit.artifactId and commit.expectedRevision in execute_command arguments. Read a document to obtain its committed revision. Retry uncertain writes with the same operation ID and input. Use query for bounded ordinary workspace reads. The host owns runs and approvals independently of browser connections.',
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
            signal: runSignals.get(token)?.signal,
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
      json(
        response,
        error instanceof z.ZodError ? 400 : (failure.status ?? 500),
        {
          error: failure.code ?? 'internal_error',
        },
      );
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
