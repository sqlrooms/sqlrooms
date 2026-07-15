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
    store.getState().ai.onChatFinish({sessionId, messages});

    const saved = store.getState().ai.getCurrentSession()!
      .uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
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
});
