import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {withRunContextTools} from '../src/chatTransport';
import {
  ChatTimeoutError,
  getPendingClientToolCalls,
  getPendingClientToolTimeouts,
  getToolExecutionTimeoutMs,
} from '../src/timeouts';
import {mergeAbortSignals} from '../src/utils';

describe('AI timeouts', () => {
  it('preserves the reason from the signal that aborts first', () => {
    const first = new AbortController();
    const second = new AbortController();
    const merged = mergeAbortSignals([first.signal, second.signal]);
    const reason = new ChatTimeoutError('run', 1_000, 'timed out');

    second.abort(reason);

    expect(merged?.aborted).toBe(true);
    expect(merged?.reason).toBe(reason);
  });

  it('supports per-tool overrides, including disabling the default', () => {
    const options = {
      toolExecutionMs: 5_000,
      tools: {query: undefined, fetchMetadata: 250},
    };
    expect(getToolExecutionTimeoutMs(options, 'chart')).toBe(5_000);
    expect(getToolExecutionTimeoutMs(options, 'query')).toBeUndefined();
    expect(getToolExecutionTimeoutMs(options, 'fetchMetadata')).toBe(250);
  });

  it('finds only pending no-execute client tools', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-clientChart',
            toolCallId: 'client-1',
            state: 'input-available',
            input: {},
          },
          {
            type: 'tool-serverQuery',
            toolCallId: 'server-1',
            state: 'input-available',
            input: {},
          },
          {
            type: 'tool-remoteOnly',
            toolCallId: 'remote-1',
            state: 'input-available',
            input: {},
          },
          {
            type: 'tool-complete',
            toolCallId: 'complete-1',
            state: 'output-available',
            input: {},
            output: {},
          },
        ],
      },
    ];

    expect(
      getPendingClientToolCalls(messages, {
        clientChart: {},
        serverQuery: {execute: async () => ({})},
      }),
    ).toEqual([{toolName: 'clientChart', toolCallId: 'client-1'}]);

    expect(
      getPendingClientToolTimeouts(
        messages,
        {
          clientChart: {},
          serverQuery: {execute: async () => ({})},
        },
        {toolExecutionMs: 1_000},
      ),
    ).toEqual([
      {toolName: 'clientChart', toolCallId: 'client-1', timeoutMs: 1_000},
    ]);
  });

  it('aborts and rejects executable tools at their configured limit', async () => {
    jest.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const wrapped = withRunContextTools(
      {
        slowTool: {
          execute: async (
            _input: unknown,
            options: {abortSignal?: AbortSignal},
          ) => {
            receivedSignal = options.abortSignal;
            return await new Promise<never>((_resolve, reject) => {
              options.abortSignal?.addEventListener(
                'abort',
                () => {
                  const abortError = new Error('The operation was aborted');
                  abortError.name = 'AbortError';
                  reject(abortError);
                },
                {once: true},
              );
            });
          },
        },
      } as any,
      {
        sessionId: 'session-1',
        state: {ai: {setToolCallSession: jest.fn()}} as any,
        timeouts: {toolExecutionMs: 500},
      },
    );

    const result = wrapped.slowTool?.execute?.({}, {toolCallId: 'tool-1'});
    const rejection = expect(result).rejects.toMatchObject({
      name: 'ChatTimeoutError',
      kind: 'tool',
      message: 'Tool "slowTool" timed out after 500ms',
    });
    await jest.advanceTimersByTimeAsync(500);

    await rejection;
    expect(receivedSignal?.aborted).toBe(true);
    expect(receivedSignal?.reason).toBeInstanceOf(ChatTimeoutError);
    jest.useRealTimers();
  });
});
