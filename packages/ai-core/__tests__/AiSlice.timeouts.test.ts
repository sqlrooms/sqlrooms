import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {createStore} from 'zustand';
import {type AiSliceState, createAiSlice} from '../src/AiSlice';
import {getChatRequestErrorMessage} from '../src/chatTurns';
import {ChatTimeoutError} from '../src/timeouts';

describe('AiSlice run timeout', () => {
  afterEach(() => jest.useRealTimers());

  it('is opt-in and records a timeout instead of a manual-cancel message', async () => {
    jest.useFakeTimers();
    const sendMessage = jest.fn();
    const stop = jest.fn();
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test',
        timeouts: {runMs: 1_000},
      })(set, get, api),
    );
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {sql: 'select 1'},
          },
          {
            type: 'tool-deleteItem',
            toolCallId: 'tool-approval',
            state: 'approval-requested',
            input: {id: 'item-1'},
            approval: {id: 'approval-1'},
          },
        ],
      },
    ];
    store.getState().ai.setSessionUiMessages(sessionId, messages);
    store.getState().ai.setPrompt(sessionId, 'hello');
    store.getState().ai.setChatSendMessage(sessionId, sendMessage);
    store.getState().ai.setChatStop(sessionId, stop);

    await store.getState().ai.startAnalysis(sessionId);
    await jest.advanceTimersByTimeAsync(1_000);

    const controller = store.getState().ai.getAbortController(sessionId);
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello'});
    expect(stop).toHaveBeenCalledTimes(1);
    expect(controller?.signal.reason).toBeInstanceOf(ChatTimeoutError);
    expect(store.getState().ai.getIsRunning(sessionId)).toBe(false);

    // The run timeout persists the failure even if useChat is paused on a
    // client tool and never invokes a transport callback.
    let saved = store.getState().ai.getCurrentSession()!
      .uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[1]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });

    // A later callback remains consistent with the persisted timeout reason.
    store.getState().ai.onChatFinish({sessionId, messages});

    saved = store.getState().ai.getCurrentSession()!.uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[1]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });
  });

  it('does not schedule a run timeout when none is configured', async () => {
    jest.useFakeTimers();
    const stop = jest.fn();
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    store.getState().ai.setChatSendMessage(sessionId, jest.fn());
    store.getState().ai.setChatStop(sessionId, stop);

    await store.getState().ai.startAnalysis(sessionId);
    await jest.advanceTimersByTimeAsync(24 * 60 * 60_000);

    expect(stop).not.toHaveBeenCalled();
    expect(
      store.getState().ai.getAbortController(sessionId)?.signal.aborted,
    ).toBe(false);
  });

  it('persists an idle timeout before a background chat can unmount', () => {
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    const session = store.getState().ai.getCurrentSession()!;
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {sql: 'select 1'},
          },
        ],
      },
    ];
    store.getState().ai.setIsRunning(session.id, true);

    store
      .getState()
      .ai.persistTimedOutSession(
        session.id,
        messages,
        'No model or tool progress received for 2s',
      );

    const savedSession = store.getState().ai.getCurrentSession()!;
    const saved = savedSession.uiMessages as UIMessage[];
    expect(savedSession.isRunning).toBe(false);
    expect(savedSession.messagesRevision).toBe(
      (session.messagesRevision || 0) + 1,
    );
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'No model or tool progress received for 2s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'No model or tool progress received for 2s',
    });
  });

  it('preserves the timeout reason when onChatError completes a pending tool', () => {
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    const controller = new AbortController();
    controller.abort(
      new ChatTimeoutError(
        'idle-stream',
        2_000,
        'No model or tool progress received for 2s',
      ),
    );
    store.getState().ai.setAbortController(sessionId, controller);

    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {sql: 'select 1'},
          },
        ],
      },
    ];

    store
      .getState()
      .ai.onChatError(
        sessionId,
        new Error('The operation was aborted'),
        messages,
      );

    const saved = store.getState().ai.getCurrentSession()!
      .uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'No model or tool progress received for 2s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'No model or tool progress received for 2s',
    });
  });
});
