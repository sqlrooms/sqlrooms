import {describe, expect, jest, test} from '@jest/globals';
import {registerWebMcpTools, type WebMcpModelContext} from '../src/webmcp';
import type {RoomCapabilityContext, RoomCapabilityRuntime} from '../src/types';

describe('registerWebMcpTools', () => {
  test('is a no-op when WebMCP is unavailable', async () => {
    const runtime = createRuntime();

    const registration = await registerWebMcpTools(runtime, {
      modelContext: undefined,
    });

    expect(registration.supported).toBe(false);
    expect(registration.registeredTools).toEqual([]);
    expect(runtime.callTool).not.toHaveBeenCalled();
  });

  test('maps the room catalog and invocation context to WebMCP', async () => {
    const registered: Array<{
      tool: Parameters<WebMcpModelContext['registerTool']>[0];
      options: Parameters<WebMcpModelContext['registerTool']>[1];
    }> = [];
    const modelContext: WebMcpModelContext = {
      registerTool: jest.fn((tool, options) => {
        registered.push({tool, options});
      }),
    };
    const runtime = createRuntime();

    const registration = await registerWebMcpTools(runtime, {
      modelContext,
      actor: 'browser-agent',
      metadata: {workspaceId: 'workspace-a'},
    });

    expect(registration).toMatchObject({
      supported: true,
      registeredTools: ['list_tables'],
    });
    expect(registered[0]?.tool).toMatchObject({
      name: 'list_tables',
      title: 'List tables',
      inputSchema: {type: 'object', additionalProperties: false},
      annotations: {readOnlyHint: true},
    });

    const executionController = new AbortController();
    await registered[0]?.tool.execute({}, {signal: executionController.signal});

    expect(runtime.callTool).toHaveBeenCalledWith(
      'list_tables',
      {},
      expect.objectContaining({
        surface: 'webmcp',
        actor: 'browser-agent',
        metadata: {
          workspaceId: 'workspace-a',
          webmcpToolName: 'list_tables',
        },
        signal: executionController.signal,
      }),
    );
    const context = (runtime.callTool as jest.Mock).mock.calls[0]?.[2] as
      | RoomCapabilityContext
      | undefined;
    expect(context?.requestId).toBeTruthy();
    expect(context?.traceId).toBe(context?.requestId);
  });

  test('aborting the lifecycle handle unregisters all tools', async () => {
    let registrationSignal: AbortSignal | undefined;
    const modelContext: WebMcpModelContext = {
      registerTool: (_tool, options) => {
        registrationSignal = options?.signal;
      },
    };

    const registration = await registerWebMcpTools(createRuntime(), {
      modelContext,
    });
    registration.dispose();

    expect(registrationSignal?.aborted).toBe(true);
  });

  test('cleans up already registered tools after a registration failure', async () => {
    let registrationSignal: AbortSignal | undefined;
    const modelContext: WebMcpModelContext = {
      registerTool: (_tool, options) => {
        registrationSignal = options?.signal;
        throw new Error('registration denied');
      },
    };

    await expect(
      registerWebMcpTools(createRuntime(), {modelContext}),
    ).rejects.toThrow('registration denied');
    expect(registrationSignal?.aborted).toBe(true);
  });
});

function createRuntime(): RoomCapabilityRuntime & {
  callTool: jest.Mock;
} {
  return {
    listTools: () => [
      {
        name: 'list_tables',
        title: 'List tables',
        description: 'List the live room tables.',
        inputSchema: {type: 'object', additionalProperties: false},
        annotations: {readOnlyHint: true},
      },
    ],
    callTool: jest.fn(async () => ({ok: true, data: {tables: []}})),
    dispose: jest.fn(),
  };
}
