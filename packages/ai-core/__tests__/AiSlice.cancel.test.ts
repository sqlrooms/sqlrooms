import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {createStore} from 'zustand';
import {type AiSliceState, createAiSlice} from '../src/AiSlice';
import {
  getChatRequestErrorMessage,
  getChatTurnCompletedAt,
} from '../src/chatTurns';
import {TOOL_CALL_CANCELLED} from '../src/constants';

describe('AiSlice cancelAnalysis', () => {
  it('persists the terminal turn when the chat is paused on an approval', () => {
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    store.getState().ai.createSession();
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    const messages: UIMessage[] = [
      {id: 'user-1', role: 'user', parts: [{type: 'text', text: 'hello'}]},
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-deleteItem',
            toolCallId: 'tool-approval',
            state: 'approval-requested',
            input: {id: 'item-1'},
            approval: {id: 'approval-1'},
          } as UIMessage['parts'][number],
        ],
      },
    ];
    store.getState().ai.setSessionUiMessages(sessionId, messages);
    const chat = store.getState().ai.getSessionChat(sessionId)!;
    chat.messages = messages;
    jest.spyOn(chat, 'stop').mockResolvedValue(undefined);
    store.getState().ai.setIsRunning(sessionId, true);
    // Nothing is in flight while an approval holds the run, so `stop()` never
    // produces a transport callback to persist the outcome.
    expect(chat.status).toBe('ready');

    store.getState().ai.cancelAnalysis(sessionId);

    const savedSession = store.getState().ai.getCurrentSession()!;
    const saved = savedSession.uiMessages as UIMessage[];
    expect(savedSession.isRunning).toBe(false);
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: TOOL_CALL_CANCELLED,
    });
    expect(getChatTurnCompletedAt(saved[0])).toEqual(expect.any(Number));
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: TOOL_CALL_CANCELLED,
    });
  });
});
