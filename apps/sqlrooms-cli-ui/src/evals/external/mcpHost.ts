import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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
