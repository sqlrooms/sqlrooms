import type {AiRunContext} from '@sqlrooms/ai-config';
import {jest} from '@jest/globals';
import type {ToolSet} from 'ai';
import {withRunContextTools} from '../src/chatTransport';

// ---------------------------------------------------------------------------
// `withRunContextTools` as a reusable nested-agent primitive.
//
// The chat transport uses it to give top-level tools their turn's execution
// scope. Nested `ToolLoopAgent` toolsets are not wrapped by the transport, so
// hosts wrap them with the parent's options — which means the helper has to work
// without transport-owned session bookkeeping, and must not clobber scope the
// inner options already carry.
// ---------------------------------------------------------------------------

function runContextWithPrimary(id: string): AiRunContext {
  return {
    items: [{kind: 'artifact', id, type: 'map', title: id}],
    primaryItemId: id,
    primaryItemKind: 'artifact',
    capturedAt: 1,
  };
}

function toolSetCapturing(calls: unknown[][]): ToolSet {
  return {
    probe: {
      execute: async (input: unknown, options: unknown) => {
        calls.push([input, options]);
        return {success: true};
      },
    },
  } as unknown as ToolSet;
}

describe('withRunContextTools', () => {
  it('forwards parent scope without requiring transport state', async () => {
    const calls: unknown[][] = [];
    const tools = withRunContextTools(toolSetCapturing(calls), {
      sessionId: 'session-1',
      aiRunContext: runContextWithPrimary('map-a'),
    });

    await tools.probe?.execute?.({}, {toolCallId: 'inner-1'} as never);

    const options = calls[0]?.[1] as {
      sessionId?: string;
      aiRunContext?: AiRunContext;
    };
    expect(options.sessionId).toBe('session-1');
    expect(options.aiRunContext?.primaryItemId).toBe('map-a');
  });

  it('attributes the tool call to the session when transport state is supplied', async () => {
    const setToolCallSession = jest.fn();
    const tools = withRunContextTools(toolSetCapturing([]), {
      sessionId: 'session-1',
      state: {ai: {setToolCallSession}} as never,
    });

    await tools.probe?.execute?.({}, {toolCallId: 'inner-1'} as never);

    expect(setToolCallSession).toHaveBeenCalledWith('inner-1', 'session-1');
  });

  it("preserves the inner call's toolCallId and abort signal", async () => {
    const calls: unknown[][] = [];
    const controller = new AbortController();
    const tools = withRunContextTools(toolSetCapturing(calls), {
      sessionId: 'session-1',
    });

    await tools.probe?.execute?.({}, {
      toolCallId: 'inner-1',
      abortSignal: controller.signal,
    } as never);

    const options = calls[0]?.[1] as {
      toolCallId?: string;
      abortSignal?: AbortSignal;
    };
    expect(options.toolCallId).toBe('inner-1');
    expect(options.abortSignal).toBe(controller.signal);
  });

  it('lets parent scope win so a nested agent cannot reassign the owning session', async () => {
    const calls: unknown[][] = [];
    const tools = withRunContextTools(toolSetCapturing(calls), {
      sessionId: 'owner-session',
    });

    await tools.probe?.execute?.({}, {
      toolCallId: 'inner-1',
      sessionId: 'nested-session',
    } as never);

    expect((calls[0]?.[1] as {sessionId?: string}).sessionId).toBe(
      'owner-session',
    );
  });

  it('preserves inner scope for fields the parent leaves undefined', async () => {
    const calls: unknown[][] = [];
    // Headless parent: a run context but no session id.
    const tools = withRunContextTools(toolSetCapturing(calls), {
      aiRunContext: runContextWithPrimary('map-a'),
    });

    await tools.probe?.execute?.({}, {
      toolCallId: 'inner-1',
      sessionId: 'inherited-session',
    } as never);

    const options = calls[0]?.[1] as {
      sessionId?: string;
      aiRunContext?: AiRunContext;
    };
    expect(options.sessionId).toBe('inherited-session');
    expect(options.aiRunContext?.primaryItemId).toBe('map-a');
  });

  it('reads the run context per call so an in-turn retarget reaches later calls', async () => {
    const calls: unknown[][] = [];
    let current = runContextWithPrimary('map-a');
    const tools = withRunContextTools(toolSetCapturing(calls), {
      sessionId: 'session-1',
      getAiRunContext: () => current,
    });

    await tools.probe?.execute?.({}, {toolCallId: 'inner-1'} as never);
    current = runContextWithPrimary('map-b');
    await tools.probe?.execute?.({}, {toolCallId: 'inner-2'} as never);

    expect(
      (calls[0]?.[1] as {aiRunContext?: AiRunContext}).aiRunContext
        ?.primaryItemId,
    ).toBe('map-a');
    expect(
      (calls[1]?.[1] as {aiRunContext?: AiRunContext}).aiRunContext
        ?.primaryItemId,
    ).toBe('map-b');
  });

  it('keeps concurrent runs isolated from each other', async () => {
    const callsA: unknown[][] = [];
    const callsB: unknown[][] = [];
    const toolsA = withRunContextTools(toolSetCapturing(callsA), {
      sessionId: 'session-a',
      getAiRunContext: () => runContextWithPrimary('map-a'),
    });
    const toolsB = withRunContextTools(toolSetCapturing(callsB), {
      sessionId: 'session-b',
      getAiRunContext: () => runContextWithPrimary('map-b'),
    });

    await Promise.all([
      toolsA.probe?.execute?.({}, {toolCallId: 'a-1'} as never),
      toolsB.probe?.execute?.({}, {toolCallId: 'b-1'} as never),
    ]);

    expect((callsA[0]?.[1] as {sessionId?: string}).sessionId).toBe(
      'session-a',
    );
    expect((callsB[0]?.[1] as {sessionId?: string}).sessionId).toBe(
      'session-b',
    );
  });

  it('leaves tools without an execute (UI-approval tools) untouched', () => {
    const approvalTool = {description: 'needs approval'} as never;
    const tools = withRunContextTools({approve: approvalTool} as ToolSet, {
      sessionId: 'session-1',
    });

    expect(tools.approve).toBe(approvalTool);
  });
});
