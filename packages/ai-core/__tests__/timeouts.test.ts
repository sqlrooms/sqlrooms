import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {withRunContextTools} from '../src/chatTransport';
import {
  ChatTimeoutError,
  getPendingClientToolCalls,
  getPendingClientToolTimeouts,
  getSessionAgentProgressSignal,
  getTimedOutSessionAgentState,
  getTimedOutToolAgentState,
  getToolExecutionTimeoutMs,
  hasPendingCurrentTurnExecutableToolCall,
  hasPendingSessionSubAgentApproval,
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

  it('includes registered executable client tools for remote transports', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-hybridWeather',
            toolCallId: 'hybrid-1',
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
            type: 'tool-serverSearch',
            toolCallId: 'server-1',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const tools = {
      hybridWeather: {execute: async () => ({})},
      serverSearch: {execute: async () => ({})},
    };

    expect(
      getPendingClientToolCalls(messages, tools, {
        executableClientToolNames: ['hybridWeather'],
      }),
    ).toEqual([{toolName: 'hybridWeather', toolCallId: 'hybrid-1'}]);
    expect(
      getPendingClientToolTimeouts(
        messages,
        tools,
        {toolExecutionMs: 1_000},
        {executableClientToolNames: ['hybridWeather']},
      ),
    ).toEqual([
      {toolName: 'hybridWeather', toolCallId: 'hybrid-1', timeoutMs: 1_000},
    ]);
  });

  it('finds pending executable tools only in the current user turn', () => {
    const previousTurn: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'first'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'query-1',
            state: 'input-available',
            input: {},
          },
        ],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{type: 'text', text: 'second'}],
      },
    ];
    const tools = {query: {execute: async () => ({})}};

    expect(hasPendingCurrentTurnExecutableToolCall(previousTurn, tools)).toBe(
      false,
    );

    const currentTurn = [
      ...previousTurn,
      {
        id: 'assistant-2',
        role: 'assistant' as const,
        parts: [
          {
            type: 'tool-query' as const,
            toolCallId: 'query-2',
            state: 'input-available' as const,
            input: {},
          },
        ],
      },
    ];
    expect(hasPendingCurrentTurnExecutableToolCall(currentTurn, tools)).toBe(
      true,
    );

    currentTurn.push({
      id: 'assistant-3',
      role: 'assistant',
      parts: [
        {
          type: 'tool-query',
          toolCallId: 'query-2',
          state: 'output-available',
          input: {},
          output: {},
        },
      ],
    });
    expect(hasPendingCurrentTurnExecutableToolCall(currentTurn, tools)).toBe(
      false,
    );
  });

  it('scopes agent progress signals to tool calls reachable from the session', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent',
            toolCallId: 'session-root',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const relevantProgress = {
      'session-root': [
        {
          toolCallId: 'nested-agent',
          toolName: 'agent-researcher',
          state: 'pending' as const,
        },
      ],
      'nested-agent': [
        {
          toolCallId: 'nested-query',
          toolName: 'query',
          state: 'pending' as const,
        },
      ],
    };
    const initialSignal = getSessionAgentProgressSignal(messages, {
      ...relevantProgress,
      'other-session': [],
    });

    expect(
      getSessionAgentProgressSignal(messages, {
        ...relevantProgress,
        'other-session': [
          {
            toolCallId: 'unrelated-query',
            toolName: 'query',
            state: 'success',
          },
        ],
      }),
    ).toBe(initialSignal);
    expect(
      getSessionAgentProgressSignal(messages, {
        ...relevantProgress,
        'nested-agent': [
          {
            toolCallId: 'nested-query',
            toolName: 'query',
            state: 'success',
          },
        ],
      }),
    ).not.toBe(initialSignal);
  });

  it('does not serialize arbitrary agent payloads into the progress signal', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent',
            toolCallId: 'session-root',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const cyclicOutput: {self?: unknown} = {};
    cyclicOutput.self = cyclicOutput;

    expect(() =>
      getSessionAgentProgressSignal(messages, {
        'session-root': [
          {
            toolCallId: 'nested-query',
            toolName: 'query',
            state: 'pending',
            input: 1n,
            output: cyclicOutput,
            startedAt: 100,
          },
        ],
      }),
    ).not.toThrow();
  });

  it('finds only nested approvals reachable from the session', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent',
            toolCallId: 'session-root',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const agentProgress = {
      'session-root': [
        {
          toolCallId: 'nested-approval',
          toolName: 'deleteItem',
          state: 'approval-requested' as const,
          approvalId: 'approval-1',
        },
      ],
    };
    const resolve = jest.fn();

    expect(
      hasPendingSessionSubAgentApproval(messages, agentProgress, {
        'approval-1': {
          toolCallId: 'nested-approval',
          approvalId: 'approval-1',
          toolName: 'deleteItem',
          input: {},
          resolve,
        },
      }),
    ).toBe(true);
    expect(
      hasPendingSessionSubAgentApproval(messages, agentProgress, {
        'approval-other': {
          toolCallId: 'other-session-tool',
          approvalId: 'approval-other',
          toolName: 'deleteItem',
          input: {},
          resolve,
        },
      }),
    ).toBe(false);
  });

  it('fails only reachable pending agent work on timeout', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent',
            toolCallId: 'session-root',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const resolve = jest.fn();
    const otherResolve = jest.fn();
    const result = getTimedOutSessionAgentState(
      messages,
      {
        'session-root': [
          {
            toolCallId: 'nested-approval',
            toolName: 'deleteItem',
            state: 'approval-requested',
            approvalId: 'approval-1',
            agentToolCalls: [
              {
                toolCallId: 'deep-query',
                toolName: 'query',
                state: 'pending',
              },
            ],
          },
        ],
        'other-session': [
          {
            toolCallId: 'other-approval',
            toolName: 'deleteItem',
            state: 'approval-requested',
            approvalId: 'approval-other',
          },
        ],
      },
      {
        'approval-1': {
          toolCallId: 'nested-approval',
          approvalId: 'approval-1',
          toolName: 'deleteItem',
          input: {},
          resolve,
        },
        'approval-other': {
          toolCallId: 'other-approval',
          approvalId: 'approval-other',
          toolName: 'deleteItem',
          input: {},
          resolve: otherResolve,
        },
      },
      'Chat run timed out after 1s',
    );

    expect(result.approvalIds).toEqual(['approval-1']);
    expect(result.agentProgress['session-root']).toEqual([
      expect.objectContaining({
        toolCallId: 'nested-approval',
        state: 'error',
        errorText: 'Chat run timed out after 1s',
        approvalId: undefined,
        completedAt: expect.any(Number),
        agentToolCalls: [
          expect.objectContaining({
            toolCallId: 'deep-query',
            state: 'error',
            errorText: 'Chat run timed out after 1s',
            completedAt: expect.any(Number),
          }),
        ],
      }),
    ]);
    expect(result.agentProgress['other-session']).toEqual([
      expect.objectContaining({
        toolCallId: 'other-approval',
        state: 'approval-requested',
        approvalId: 'approval-other',
      }),
    ]);
  });

  it('relabels cancellation cleanup beneath a timed-out tool', () => {
    const result = getTimedOutToolAgentState(
      'session-root',
      {
        'session-root': [
          {
            toolCallId: 'nested-query',
            toolName: 'query',
            state: 'error',
            errorText: 'Tool call cancelled by user',
          },
        ],
      },
      {},
      'Tool "agent" timed out after 1s',
    );

    expect(result.agentProgress['session-root']).toEqual([
      expect.objectContaining({
        toolCallId: 'nested-query',
        state: 'error',
        errorText: 'Tool "agent" timed out after 1s',
        completedAt: expect.any(Number),
      }),
    ]);
  });

  it('aborts and rejects executable tools at their configured limit', async () => {
    jest.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const agentProgress = {
      'tool-1': [
        {
          toolCallId: 'nested-query',
          toolName: 'query',
          state: 'pending' as const,
        },
      ],
    };
    const updateAgentProgress = jest.fn(
      (parentToolCallId: string, toolCalls: unknown[]) => {
        agentProgress[parentToolCallId as 'tool-1'] = toolCalls as never;
      },
    );
    const testState = {
      ai: {
        setToolCallSession: jest.fn(),
        agentProgress,
        pendingSubAgentApprovals: {},
        updateAgentProgress,
        resolveSubAgentApproval: jest.fn(),
      },
    };
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
        state: testState as any,
        getState: () => testState as any,
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
    expect(updateAgentProgress).toHaveBeenCalledWith('tool-1', [
      expect.objectContaining({
        toolCallId: 'nested-query',
        state: 'error',
        errorText: 'Tool "slowTool" timed out after 500ms',
      }),
    ]);
    jest.useRealTimers();
  });
});
