import {jest} from '@jest/globals';
import type {UIMessageChunk} from 'ai';

const actualAi = await import('ai');

let capturedOnError: ((error: unknown) => string) | undefined;

function createErrorStream(error: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      const errorText = capturedOnError?.(error) ?? 'An error occurred.';
      const chunk: UIMessageChunk = {type: 'error', errorText};
      yield chunk;
    },
  };
}

const RAW_MESSAGE =
  'provider rejected the request: 429 rate limited (key sk-live-abc123)';

let streamError: unknown = new Error(RAW_MESSAGE);

let rejectOnCreate: unknown;

const createAgentUIStream = jest.fn(
  async (options: {onError?: (error: unknown) => string}) => {
    capturedOnError = options.onError;
    if (rejectOnCreate) throw rejectOnCreate;
    return createErrorStream(streamError);
  },
);

jest.unstable_mockModule('ai', () => ({
  ...actualAi,
  createAgentUIStream,
}));

const {streamSubAgent, getSubAgentErrorMessage, SUB_AGENT_ERROR_MESSAGE} =
  await import('../src/agents/AgentUtils');

function createStubStore() {
  return {
    getState: () => ({
      ai: {
        updateAgentProgress: jest.fn(),
        clearAgentProgress: jest.fn(),
      },
    }),
  } as any;
}

describe('streamSubAgent error surfacing', () => {
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {}) as any;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    streamError = new Error(RAW_MESSAGE);
    rejectOnCreate = undefined;
  });

  it('keeps the raw child exception out of the message handed to the parent model', async () => {
    await expect(
      streamSubAgent(
        {} as any,
        'do something',
        createStubStore(),
        'parent-tool-call-redacted',
      ),
    ).rejects.toThrow(SUB_AGENT_ERROR_MESSAGE);

    // A caller such as runSkillTool serializes err.message into a tool result
    // sent to the parent model, which may run on a different provider.
    const thrown = await streamSubAgent(
      {} as any,
      'do something',
      createStubStore(),
      'parent-tool-call-redacted-2',
    ).catch((err: unknown) => (err as Error).message);

    expect(thrown).not.toContain('sk-live-abc123');
    expect(thrown).not.toContain('429 rate limited');
  });

  it('preserves the raw error in the console for local diagnostics', async () => {
    await streamSubAgent(
      {} as any,
      'do something',
      createStubStore(),
      'parent-tool-call-console',
    ).catch(() => {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Sub-agent stream error:',
      expect.objectContaining({message: RAW_MESSAGE}),
    );
  });

  it('returns the underlying message when a caller opts in via formatError', async () => {
    await expect(
      streamSubAgent(
        {} as any,
        'do something',
        createStubStore(),
        'parent-tool-call-optin',
        undefined,
        {formatError: getSubAgentErrorMessage},
      ),
    ).rejects.toThrow(RAW_MESSAGE);
  });

  it('redacts a failure raised before stream iteration begins', async () => {
    // createAgentUIStream can reject before onError is ever wired up.
    rejectOnCreate = new Error(RAW_MESSAGE);

    const thrown = await streamSubAgent(
      {} as any,
      'do something',
      createStubStore(),
      'parent-tool-call-create-failure',
    ).catch((err: unknown) => (err as Error).message);

    expect(thrown).toBe(SUB_AGENT_ERROR_MESSAGE);
    expect(thrown).not.toContain('sk-live-abc123');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Sub-agent stream error:',
      expect.objectContaining({message: RAW_MESSAGE}),
    );
  });

  it('honours formatError for a failure raised before stream iteration', async () => {
    rejectOnCreate = new Error(RAW_MESSAGE);

    await expect(
      streamSubAgent(
        {} as any,
        'do something',
        createStubStore(),
        'parent-tool-call-create-optin',
        undefined,
        {formatError: getSubAgentErrorMessage},
      ),
    ).rejects.toThrow(RAW_MESSAGE);
  });

  it('applies formatError exactly once to a streamed provider failure', async () => {
    const formatError = jest.fn(
      (error: unknown) => `subagent: ${getSubAgentErrorMessage(error)}`,
    );

    const thrown = await streamSubAgent(
      {} as any,
      'do something',
      createStubStore(),
      'parent-tool-call-once',
      undefined,
      {formatError},
    ).catch((err: unknown) => (err as Error).message);

    expect(thrown).toBe(`subagent: ${RAW_MESSAGE}`);
    expect(thrown).not.toContain('subagent: subagent:');
    expect(formatError).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to the SDK default redaction', async () => {
    await streamSubAgent(
      {} as any,
      'do something',
      createStubStore(),
      'parent-tool-call-wiring',
    ).catch(() => {});

    expect(createAgentUIStream).toHaveBeenCalledWith(
      expect.objectContaining({onError: expect.any(Function)}),
    );
    expect(capturedOnError?.(new Error('boom'))).not.toBe('An error occurred.');
  });
});

describe('getSubAgentErrorMessage', () => {
  it('extracts messages from the shapes a provider can throw', () => {
    expect(getSubAgentErrorMessage(new Error('boom'))).toBe('boom');
    expect(getSubAgentErrorMessage('plain string error')).toBe(
      'plain string error',
    );
    expect(getSubAgentErrorMessage(undefined)).toBe('unknown error');
    expect(getSubAgentErrorMessage({status: 429})).toBe('{"status":429}');
  });

  it('still returns a string for values JSON.stringify cannot encode', () => {
    expect(getSubAgentErrorMessage(Symbol('boom'))).toBe('Symbol(boom)');
    expect(getSubAgentErrorMessage(() => {})).toContain('=>');
  });
});
