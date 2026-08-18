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
  it('starts without a mounted React chat provider', async () => {
    const store = createTestStore();
    const chat = store.getState().ai.getSessionChat('session-1')!;
    const sendMessage = jest
      .spyOn(chat, 'sendMessage')
      .mockResolvedValue(undefined);

    await store.getState().ai.startAnalysis('session-1');

    expect(sendMessage).toHaveBeenCalledWith({text: 'hello world'});
    expect(store.getState().ai.getCurrentSession()?.prompt).toBe('');
  });

  it('reuses the same chat and delegates immediately', async () => {
    const store = createTestStore();
    const first = store.getState().ai.getSessionChat('session-1')!;
    const sendMessage = jest
      .spyOn(first, 'sendMessage')
      .mockResolvedValue(undefined);

    await expect(
      store.getState().ai.startAnalysisWhenReady('session-1'),
    ).resolves.toBe(true);

    expect(store.getState().ai.getSessionChat('session-1')).toBe(first);
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello world'});
  });

  it('returns false for an unknown session', async () => {
    const store = createTestStore();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      store.getState().ai.startAnalysisWhenReady('missing'),
    ).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalledWith('Session not found:', 'missing');
    errorSpy.mockRestore();
  });

  it('replaces and fences a stale chat generation', () => {
    const store = createTestStore();
    const first = store.getState().ai.getSessionChat('session-1')!;
    const stop = jest.spyOn(first, 'stop').mockResolvedValue(undefined);

    store.getState().ai.persistTimedOutSession('session-1', [], 'timed out');
    const second = store.getState().ai.getSessionChat('session-1')!;

    expect(second).not.toBe(first);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('disposes live chats and abort signals on slice destruction', async () => {
    const store = createTestStore();
    const chat = store.getState().ai.getSessionChat('session-1')!;
    const stop = jest.spyOn(chat, 'stop').mockResolvedValue(undefined);
    const abortController = new AbortController();
    store.getState().ai.setAbortController('session-1', abortController);

    await store.getState().ai.destroy?.();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(abortController.signal.aborted).toBe(true);
    expect(store.getState().ai.getAbortController('session-1')).toBeUndefined();
  });
});
