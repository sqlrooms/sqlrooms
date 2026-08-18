import {jest} from '@jest/globals';
import {Chat} from '@ai-sdk/react';
import type {UIMessage} from 'ai';
import {
  createSessionChatRuntime,
  createSessionChatRuntimeRegistry,
  type SessionChatController,
} from '../src/sessionChatRuntime';

const userMessage: UIMessage = {
  id: 'user-1',
  role: 'user',
  parts: [{type: 'text', text: 'hello'}],
};

function createRuntimeState(overrides: Record<string, unknown> = {}) {
  return {
    isRunning: false,
    abortController: undefined,
    tools: {},
    remoteClientToolNames: [],
    timeouts: {},
    agentProgress: {},
    pendingSubAgentApprovals: {},
    ...overrides,
  } as any;
}

describe('sessionChatRuntime', () => {
  afterEach(() => jest.useRealTimers());

  it('persists SDK message changes until disposed', () => {
    const chat = new Chat<UIMessage>({messages: []});
    jest.spyOn(chat, 'stop').mockResolvedValue(undefined);
    const onMessagesChange = jest.fn();
    const runtime = createSessionChatRuntime({
      chat,
      usesRemoteTransport: false,
      getState: () => createRuntimeState(),
      onMessagesChange,
      onIdleTimeout: jest.fn(),
    });

    chat.messages = [userMessage];
    expect(onMessagesChange).toHaveBeenLastCalledWith([userMessage]);

    runtime.dispose();
    chat.messages = [];
    expect(onMessagesChange).toHaveBeenCalledTimes(1);
  });

  it('fences callbacks, persists, then stops on an idle timeout', async () => {
    jest.useFakeTimers();
    const abortController = new AbortController();
    const chat = new Chat<UIMessage>({messages: [userMessage]});
    const stop = jest.spyOn(chat, 'stop').mockResolvedValue(undefined);
    const events: string[] = [];
    const onIdleTimeout = jest.fn(() => events.push('persist'));

    createSessionChatRuntime({
      chat,
      usesRemoteTransport: false,
      getState: () =>
        createRuntimeState({
          isRunning: true,
          abortController,
          timeouts: {idleStreamMs: 100},
        }),
      onMessagesChange: jest.fn(),
      onIdleTimeout,
      onDeactivate: () => events.push('fence'),
    });

    await jest.advanceTimersByTimeAsync(100);

    expect(abortController.signal.aborted).toBe(true);
    expect(onIdleTimeout).toHaveBeenCalledWith(
      [userMessage],
      expect.objectContaining({kind: 'idle-stream'}),
    );
    expect(events).toEqual(['fence', 'persist']);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('fails a client tool that does not provide output in time', async () => {
    jest.useFakeTimers();
    const toolMessage: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-clientTool',
          toolCallId: 'tool-1',
          state: 'input-available',
          input: {},
        },
      ],
    };
    const chat = new Chat<UIMessage>({messages: [userMessage, toolMessage]});
    const addToolOutput = jest
      .spyOn(chat, 'addToolOutput')
      .mockResolvedValue(undefined);

    createSessionChatRuntime({
      chat,
      usesRemoteTransport: false,
      getState: () =>
        createRuntimeState({
          isRunning: true,
          tools: {clientTool: {}},
          timeouts: {toolExecutionMs: 100},
        }),
      onMessagesChange: jest.fn(),
      onIdleTimeout: jest.fn(),
    });

    await jest.advanceTimersByTimeAsync(100);

    expect(addToolOutput).toHaveBeenCalledWith({
      tool: 'clientTool',
      toolCallId: 'tool-1',
      state: 'output-error',
      errorText: 'Tool "clientTool" timed out after 100ms',
    });
  });

  it('reuses a generation and disposes it before replacement', () => {
    const registry = createSessionChatRuntimeRegistry();
    const first = {
      chat: new Chat<UIMessage>({messages: []}),
      refresh: jest.fn(),
      dispose: jest.fn(),
    } satisfies SessionChatController;
    let isFirstCurrent = () => false;
    const created = registry.ensure('session-1', '0', (lifecycle) => {
      isFirstCurrent = lifecycle.isCurrent;
      return first;
    });

    expect(isFirstCurrent()).toBe(true);
    expect(registry.ensure('session-1', '0', () => first)).toBe(created);

    let previousWasDisposed = false;
    const second = registry.ensure('session-1', '1', () => {
      previousWasDisposed = first.dispose.mock.calls.length === 1;
      return {
        ...first,
        dispose: jest.fn(),
      };
    });

    expect(previousWasDisposed).toBe(true);
    expect(isFirstCurrent()).toBe(false);
    expect(second).not.toBe(first);
  });
});
