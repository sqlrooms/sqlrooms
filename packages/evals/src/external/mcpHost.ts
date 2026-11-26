import {randomBytes} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {Server} from '@modelcontextprotocol/sdk/server/index.js';
import type {HarnessHostConnection} from './harness.js';

/** A running evaluation MCP host. */
export type EvalMcpHost = HarnessHostConnection & {
  /** Closes connections, waits for in-flight requests and removes credentials. */
  dispose(): Promise<void>;
};

/**
 * Serves an application's MCP server over loopback Streamable HTTP.
 *
 * Each HTTP request gets a fresh server from `createServer` in stateless
 * mode; the application's workspace behind it is shared. Requests must carry
 * the random bearer token and come from the bound loopback host with no
 * `Origin`. The token is also written to an owner-only credential file for
 * clients that read it through a header helper. The host owns no operations.
 */
export async function startEvalMcpHost(options: {
  createServer: () => Server;
  /**
   * Called when a request cannot be served: the server factory threw, or the
   * transport failed. The client receives an HTTP 500.
   */
  onError?: (error: unknown) => void;
  /** Credential file prefix; defaults to `sqlrooms-eval-auth-`. */
  credentialPrefix?: string;
}): Promise<EvalMcpHost> {
  // Loaded here, not at module load: `@modelcontextprotocol/sdk` is an
  // optional peer, and the rest of `@sqlrooms/evals/external` (process runner,
  // supervisor, harness adapters) works without it.
  const {StreamableHTTPServerTransport} =
    await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const token = randomBytes(32).toString('hex');
  const sessions = new Set<Server>();
  const pending = new Set<Promise<unknown>>();
  const http = createServer(async (request, response) => {
    if (
      request.url !== '/mcp' ||
      request.headers.origin !== undefined ||
      request.headers.host !==
        `127.0.0.1:${(http.address() as AddressInfo).port}` ||
      request.headers.authorization !== `Bearer ${token}`
    ) {
      response.writeHead(403).end();
      return;
    }
    const fail = (error: unknown) => {
      if (!response.headersSent && !response.destroyed)
        response.writeHead(500).end();
      else response.end();
      if (options.onError) options.onError(error);
      else console.error('MCP request failed:', error);
    };
    let server: Server;
    try {
      server = options.createServer();
    } catch (error) {
      fail(error);
      return;
    }
    sessions.add(server);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    // Closing the server drops the transport's response map, so a request
    // whose client disconnected may never settle. Track it until either it
    // settles or its response closes; the application drains the tool work
    // itself (`PreparedExternalTarget.drain`).
    const closed = new Promise<void>((resolve) =>
      response.once('close', () => {
        sessions.delete(server);
        void server.close();
        resolve();
      }),
    );
    const handled = (async () => {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    })().catch(fail);
    const settled = Promise.race([handled, closed]);
    pending.add(settled);
    try {
      await settled;
    } finally {
      pending.delete(settled);
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
      path.join(tmpdir(), options.credentialPrefix ?? 'sqlrooms-eval-auth-'),
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
      await Promise.allSettled([...sessions].map((server) => server.close()));
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
      await Promise.allSettled(pending);
    },
  };
}
