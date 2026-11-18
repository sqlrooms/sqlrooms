import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {startEvalMcpHost as startHost} from '@sqlrooms/evals/external';
import type {createCliCapabilityRuntime} from '../../createCliCapabilityRuntime';

type CliCapabilityRuntime = ReturnType<typeof createCliCapabilityRuntime>;

/** One stateless MCP server over the shared CLI capability runtime. */
export function createCliMcpServer(
  runtime: CliCapabilityRuntime,
  onRequest: (method: string, input?: unknown) => void = () => {},
) {
  const server = new Server(
    {name: 'sqlrooms-isolated-eval', version: '1.0.0'},
    {capabilities: {tools: {}}},
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    onRequest('tools/list');
    return {tools: runtime.listTools()};
  });
  server.setRequestHandler(CallToolRequestSchema, async (call, extra) => {
    onRequest(`tools/call:${call.params.name}`, {
      requestId: extra.requestId,
      ...call.params,
    });
    const result = await runtime.callTool(
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
    return {
      content: [{type: 'text' as const, text: JSON.stringify(result)}],
      structuredContent: result,
      isError: !result.ok,
    };
  });
  return server;
}

/** Real local MCP transport around the shared CLI runtime; owns no operations. */
export async function startEvalMcpHost(
  runtime: CliCapabilityRuntime,
  onRequest?: (method: string, input?: unknown) => void,
) {
  const host = await startHost({
    createServer: () => createCliMcpServer(runtime, onRequest),
  });
  let disposed = false;
  return {
    url: host.url,
    token: host.token,
    credentialFile: host.credentialFile,
    async dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      await host.dispose();
      await runtime.drain();
    },
  };
}
