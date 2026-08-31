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

let streamError: unknown = new Error(
  'provider rejected the request: 429 rate limited',
);

const createAgentUIStream = jest.fn(
  async (options: {onError?: (error: unknown) => string}) => {
    capturedOnError = options.onError;
    return createErrorStream(streamError);
  },
);

jest.unstable_mockModule('ai', () => ({
  ...actualAi,
  createAgentUIStream,
}));

const {streamSubAgent} = await import('../src/agents/AgentUtils');

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
  afterEach(() => {
    streamError = new Error('provider rejected the request: 429 rate limited');
  });

  it('rejects with the real error message instead of the SDK default redaction', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      await expect(
        streamSubAgent(
          {} as any,
          'do something',
          createStubStore(),
          'parent-tool-call-1',
        ),
      ).rejects.toThrow('provider rejected the request: 429 rate limited');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Sub-agent stream error:',
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('passes an onError to createAgentUIStream that never falls back to the generic redaction', async () => {
    await streamSubAgent(
      {} as any,
      'do something',
      createStubStore(),
      'parent-tool-call-2',
    ).catch(() => {});

    expect(createAgentUIStream).toHaveBeenCalledWith(
      expect.objectContaining({onError: expect.any(Function)}),
    );
    expect(capturedOnError?.(new Error('boom'))).toBe('boom');
    expect(capturedOnError?.('plain string error')).toBe('plain string error');
  });

  it('still produces a message for a thrown value JSON.stringify cannot encode', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    streamError = Symbol('boom');

    try {
      await expect(
        streamSubAgent(
          {} as any,
          'do something',
          createStubStore(),
          'parent-tool-call-symbol',
        ),
      ).rejects.toThrow('Symbol(boom)');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
