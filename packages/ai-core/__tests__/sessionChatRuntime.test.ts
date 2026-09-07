import {jest} from '@jest/globals';
import {Chat} from '@ai-sdk/react';
import type {UIMessage} from 'ai';
import {createSessionChatRuntime} from '../src/sessionChatRuntime';

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
    const unsubscribe = jest.fn();
    const runtime = createSessionChatRuntime({
      chat,
      usesRemoteTransport: false,
      getState: () => createRuntimeState(),
      subscribeToStateChanges: () => unsubscribe,
      onMessagesChange,
      onIdleTimeout: jest.fn(),
    });

    chat.messages = [userMessage];
    expect(onMessagesChange).toHaveBeenLastCalledWith([userMessage]);

    runtime.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
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
    let state = createRuntimeState();
    let notifyStateChange = () => {};

    createSessionChatRuntime({
      chat,
      usesRemoteTransport: false,
      getState: () => state,
      subscribeToStateChanges: (onChange) => {
        notifyStateChange = onChange;
        return jest.fn();
      },
      onMessagesChange: jest.fn(),
      onIdleTimeout,
      onDeactivate: () => events.push('fence'),
    });
    state = createRuntimeState({
      isRunning: true,
      abortController,
      timeouts: {idleStreamMs: 100},
    });
    notifyStateChange();

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
      subscribeToStateChanges: () => jest.fn(),
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
});
