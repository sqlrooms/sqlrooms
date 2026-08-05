import {jest} from '@jest/globals';
import {createStore} from 'zustand';
import {AiSliceState, createAiSlice} from '../src/AiSlice';

function createTestStore() {
  return createStore<AiSliceState>((set, get, store) =>
    createAiSlice({
      tools: {} as any,
      getInstructions: () => 'test instructions',
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
            prompt: 'hello world',
            isRunning: false,
            lastOpenedAt: Date.now(),
          },
        ],
      },
    })(set, get, store),
  );
}

describe('startAnalysisWhenReady', () => {
  it('drops the prompt when sendMessage is not registered yet (the bug)', async () => {
    const store = createTestStore();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // SessionChatProvider has not mounted / registered sendMessage yet.
    await store.getState().ai.startAnalysis('session-1');

    expect(errorSpy).toHaveBeenCalledWith(
      'No sendMessage function found for session:',
      'session-1',
    );
    // Prompt is left untouched because nothing was sent.
    expect(store.getState().ai.getCurrentSession()?.prompt).toBe('hello world');
    errorSpy.mockRestore();
  });

  it('waits for a late sendMessage registration, then sends the prompt', async () => {
    const store = createTestStore();
    const sendMessage = jest.fn();

    // Kick off the analysis before the provider has registered sendMessage.
    const readyPromise = store
      .getState()
      .ai.startAnalysisWhenReady('session-1');

    // Simulate SessionChatProvider mounting and registering in a later tick,
    // the way a passive effect would after createSession().
    setTimeout(() => {
      store.getState().ai.setChatSendMessage('session-1', sendMessage as any);
    }, 30);

    await expect(readyPromise).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello world'});
    // Prompt is cleared once the message is dispatched.
    expect(store.getState().ai.getCurrentSession()?.prompt).toBe('');
  });

  it('sends immediately when sendMessage is already registered', async () => {
    const store = createTestStore();
    const sendMessage = jest.fn();
    store.getState().ai.setChatSendMessage('session-1', sendMessage as any);

    await expect(
      store.getState().ai.startAnalysisWhenReady('session-1'),
    ).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello world'});
  });
});
