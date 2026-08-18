import {afterEach, describe, expect, jest, test} from '@jest/globals';
import {createRoomCapabilityRuntime} from '../src';

afterEach(() => {
  jest.useRealTimers();
});

function capability(name: string) {
  return {
    name,
    description: `${name} capability`,
    inputSchema: {
      type: 'object' as const,
      properties: {value: {type: 'string'}},
      required: ['value'],
      additionalProperties: false,
    },
    execute: jest.fn(async (input: unknown) => ({
      ok: true as const,
      data: input,
    })),
  };
}

describe('createRoomCapabilityRuntime', () => {
  test('lists tools deterministically and returns defensive copies', () => {
    const runtime = createRoomCapabilityRuntime({
      capabilities: [capability('zeta'), capability('alpha')],
    });
    const first = runtime.listTools();
    expect(first.map((tool) => tool.name)).toEqual(['alpha', 'zeta']);
    first[0]!.description = 'changed';
    expect(runtime.listTools()[0]!.description).toBe('alpha capability');
  });

  test('rejects duplicate and invalid names', () => {
    expect(() =>
      createRoomCapabilityRuntime({
        capabilities: [capability('same'), capability('same')],
      }),
    ).toThrow('Duplicate');
    expect(() =>
      createRoomCapabilityRuntime({capabilities: [capability('bad.name')]}),
    ).toThrow('Invalid');
  });

  test('validates inputs before execution', async () => {
    const tool = capability('echo');
    const runtime = createRoomCapabilityRuntime({capabilities: [tool]});
    await expect(
      runtime.callTool('echo', {}, {surface: 'api'}),
    ).resolves.toMatchObject({ok: false, code: 'invalid_input'});
    expect(tool.execute).not.toHaveBeenCalled();
  });

  test('applies policy denial and disposal', async () => {
    const tool = capability('echo');
    const runtime = createRoomCapabilityRuntime({
      capabilities: [tool],
      policy: {
        authorize: async () => ({
          allowed: false,
          result: {ok: false, code: 'denied', message: 'No.'},
        }),
      },
    });
    await expect(
      runtime.callTool('echo', {value: 'x'}, {surface: 'api'}),
    ).resolves.toEqual({ok: false, code: 'denied', message: 'No.'});
    runtime.dispose();
    await expect(
      runtime.callTool('echo', {value: 'x'}, {surface: 'api'}),
    ).resolves.toMatchObject({ok: false, code: 'runtime_disposed'});
  });

  test('normalizes timeouts', async () => {
    jest.useFakeTimers();
    const runtime = createRoomCapabilityRuntime({
      timeoutMs: 5,
      capabilities: [
        {
          ...capability('slow'),
          execute: async () => await new Promise(() => {}),
        },
      ],
    });
    const result = runtime.callTool('slow', {value: 'x'}, {surface: 'api'});
    await jest.advanceTimersByTimeAsync(10);
    await expect(result).resolves.toMatchObject({ok: false, code: 'timeout'});
  });

  test('applies the timeout to authorization', async () => {
    jest.useFakeTimers();
    const tool = capability('guarded');
    const runtime = createRoomCapabilityRuntime({
      timeoutMs: 5,
      capabilities: [tool],
      policy: {authorize: async () => await new Promise(() => {})},
    });

    const result = runtime.callTool('guarded', {value: 'x'}, {surface: 'api'});
    await jest.advanceTimersByTimeAsync(10);

    await expect(result).resolves.toMatchObject({ok: false, code: 'timeout'});
    expect(tool.execute).not.toHaveBeenCalled();
  });

  test('does not execute when the caller signal is already aborted', async () => {
    const tool = capability('cancelled');
    const controller = new AbortController();
    controller.abort();
    const runtime = createRoomCapabilityRuntime({capabilities: [tool]});

    await expect(
      runtime.callTool(
        'cancelled',
        {value: 'x'},
        {surface: 'api', signal: controller.signal},
      ),
    ).resolves.toMatchObject({ok: false, code: 'cancelled'});
    expect(tool.execute).not.toHaveBeenCalled();
  });

  test('rejects non-serializable results', async () => {
    const runtime = createRoomCapabilityRuntime({
      capabilities: [
        {
          ...capability('circular'),
          execute: async () => {
            const value: Record<string, unknown> = {};
            value.self = value;
            return {ok: true as const, data: value};
          },
        },
      ],
    });
    await expect(
      runtime.callTool('circular', {value: 'x'}, {surface: 'api'}),
    ).resolves.toMatchObject({ok: false, code: 'not_serializable'});
  });
});
