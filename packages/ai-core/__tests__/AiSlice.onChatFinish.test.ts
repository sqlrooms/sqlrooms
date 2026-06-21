import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {createStore} from 'zustand';
import {AiSliceState, createAiSlice} from '../src/AiSlice';

function createTestStore(onChatFinish: any) {
  return createStore<AiSliceState>((set, get, store) =>
    createAiSlice({
      tools: {} as any,
      getInstructions: () => 'test instructions',
      onChatFinish,
      config: {
        currentSessionId: 'session-1',
        openSessionTabs: ['session-1'],
        sessions: [
          {
            id: 'session-1',
            name: 'Session 1',
            modelProvider: 'openai',
            model: 'gpt-test',
            createdAt: new Date(),
            uiMessages: [],
            messagesRevision: 0,
            prompt: '',
            isRunning: true,
            lastOpenedAt: Date.now(),
          },
        ],
      },
    })(set, get, store),
  );
}

function createCompletedMessages(): UIMessage[] {
  return [
    {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'Create a worksheet'}],
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{type: 'text', text: 'Created it.'}],
    },
  ];
}

describe('AiSlice onChatFinish option', () => {
  it('runs after completed messages are persisted and the session ends', () => {
    const onChatFinish = jest.fn();
    const store = createTestStore(onChatFinish);
    const messages = createCompletedMessages();

    store.getState().ai.onChatFinish({sessionId: 'session-1', messages});

    expect(onChatFinish).toHaveBeenCalledWith({
      sessionId: 'session-1',
      messages,
    });
    expect(store.getState().ai.getIsRunning('session-1')).toBe(false);
    expect(store.getState().ai.getCurrentSession()?.uiMessages).toEqual(
      messages,
    );
  });

  it('does not run for aborted turns', () => {
    const onChatFinish = jest.fn();
    const store = createTestStore(onChatFinish);
    const controller = new AbortController();
    controller.abort('cancelled');
    store.getState().ai.setAbortController('session-1', controller);

    store.getState().ai.onChatFinish({
      sessionId: 'session-1',
      messages: createCompletedMessages(),
    });

    expect(onChatFinish).not.toHaveBeenCalled();
  });
});
