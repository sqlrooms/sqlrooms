import {expect, it} from '@jest/globals';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createCliHeadlessWorkspace} from '../createCliHeadlessWorkspace';
import {createCliCapabilityRuntime} from '../../createCliCapabilityRuntime';
import {isolatedEvalPolicy} from '../external/policy';
import {startEvalMcpHost} from '../external/mcpHost';

it('discovers and executes through real MCP, enforces fixture policy and closes the host', async () => {
  const workspace = createCliHeadlessWorkspace();
  const client = new Client({name: 'deterministic-mcp-check', version: '1'});
  let host: Awaited<ReturnType<typeof startEvalMcpHost>> | undefined;
  try {
    await workspace.initialize();
    const runtime = createCliCapabilityRuntime({
      store: workspace.store,
      policy: isolatedEvalPolicy,
    });
    host = await startEvalMcpHost(runtime);
    expect((await fetch(host.url)).status).toBe(403);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(host.url), {
        requestInit: {headers: {Authorization: `Bearer ${host.token}`}},
      }),
    );
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
      'execute_command',
    );
    const call = async (name: string, args: Record<string, unknown>) =>
      (await client.callTool({name, arguments: args})).structuredContent;
    expect(await call('list_tables', {})).toMatchObject({
      ok: true,
      data: {totalCount: 2},
    });
    expect(await call('read_table_schema', {tableId: 'events'})).toMatchObject({
      ok: false,
      code: 'table_ambiguous',
    });
    expect(
      await call('query', {sql: 'select * from analytics.events', maxRows: 1}),
    ).toMatchObject({ok: true, data: {rowCount: 1, truncated: true}});
    expect(
      await call('query', {sql: 'drop table analytics.events'}),
    ).toMatchObject({ok: false, code: 'query_not_readonly'});
    expect(
      await call('query', {
        sql: "select * from read_csv('/tmp/nonexistent.csv')",
      }),
    ).toMatchObject({ok: false, code: 'query_failed'});
    expect(
      await call('execute_command', {
        commandId: 'room.add-sql-data-source',
        input: {confirmed: true},
      }),
    ).toMatchObject({ok: false, code: 'permission_denied'});
    expect(
      await call('execute_command', {
        commandId: 'block-document.get',
        input: {},
      }),
    ).toMatchObject({ok: false, code: 'permission_denied'});
    expect(
      await call('execute_command', {
        commandId: 'block-document.create-artifact',
        input: {title: 'MCP proof'},
      }),
    ).toMatchObject({ok: true});
    const id = workspace.store.getState().artifacts.config.currentArtifactId;
    expect(
      await call('execute_command', {
        commandId: 'block-document.get',
        input: {artifactId: id},
      }),
    ).toMatchObject({ok: true});
  } finally {
    await client.close();
    await host?.dispose();
    await workspace.dispose();
  }
  await expect(fetch(host!.url)).rejects.toThrow();
});

it('drains a command that ignores abort before host disposal completes', async () => {
  const workspace = createCliHeadlessWorkspace();
  let finish!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  let host: Awaited<ReturnType<typeof startEvalMcpHost>> | undefined;
  try {
    await workspace.initialize();
    workspace.store.getState().commands.registerCommand('test', {
      id: 'test.delayed',
      name: 'Delayed mutation',
      execute: async () => {
        started();
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        workspace.store.getState().artifacts.createArtifact({
          type: 'block-document',
          title: 'Late mutation',
        });
        return {success: true, commandId: 'test.delayed'};
      },
    });
    const runtime = createCliCapabilityRuntime({
      store: workspace.store,
      policy: {authorize: () => ({allowed: true})},
    });
    host = await startEvalMcpHost(runtime);
    const call = runtime.callTool(
      'execute_command',
      {commandId: 'test.delayed'},
      {surface: 'mcp-http'},
    );
    await startedPromise;
    let disposed = false;
    const shutdown = host.dispose().then(() => {
      disposed = true;
    });
    expect(await call).toMatchObject({ok: false, code: 'cancelled'});
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(disposed).toBe(false);
    finish();
    await shutdown;
    expect(
      Object.values(workspace.store.getState().artifacts.config.artifactsById),
    ).toHaveLength(1);
  } finally {
    finish?.();
    await host?.dispose();
    await workspace.dispose();
  }
});
