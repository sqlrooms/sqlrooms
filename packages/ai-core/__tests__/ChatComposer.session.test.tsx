/**
 * @jest-environment jsdom
 *
 * Session-mode composer behavior against a real AI slice: lazy session
 * creation, prompt transfer, cancellation — plus what `useChatComposer()` does
 * when no provider published state at all.
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {
  cleanup,
  createSessionTestStore,
  fireKeyDown,
  mockChatRuntimeModule,
  renderTree,
  stubAnalysisActions,
  textarea,
  typeInto,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {
  useChatComposer,
  SessionChatComposerProvider,
  ChatComposerStateBoundary,
  Input,
  Send,
  Stop,
} = await import('../src/components/composer');

type Composer = ReturnType<typeof useChatComposer>;

describe('useChatComposer — no provider present', () => {
  it('throws a clear, actionable error naming how to fix it', async () => {
    const store = createSessionTestStore();
    let caught: unknown;
    function Reader() {
      try {
        useChatComposer();
      } catch (error) {
        caught = error;
      }
      return null;
    }

    // A component that throws during render leaves React logging an error
    // boundary warning to the console; that's expected here and not asserted
    // on — only the thrown error itself is.
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <Reader />
      </RoomStateProvider>,
    );

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Chat/);

    consoleError.mockRestore();
    await cleanup(container, root);
  });

  it('ChatComposerStateBoundary supplies working session-mode state on its own', async () => {
    const store = createSessionTestStore();
    let seen: Composer | undefined;
    function Reader() {
      seen = useChatComposer();
      return null;
    }

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <ChatComposerStateBoundary>
          <Reader />
        </ChatComposerStateBoundary>
      </RoomStateProvider>,
    );

    expect(seen?.mode).toBe('session');
    expect(seen?.canSend).toBe(false);

    await cleanup(container, root);
  });
});

describe('composer primitives — session mode', () => {
  it('Enter creates a session, transfers the prompt, clears the draft, and starts via the when-ready entry point', async () => {
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <SessionChatComposerProvider>
          <Input />
        </SessionChatComposerProvider>
      </RoomStateProvider>,
    );

    await act(async () => {
      typeInto(textarea(container)!, 'plot revenue');
    });
    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    const session = store.getState().ai.getCurrentSession();
    expect(session).toBeDefined();
    expect(session?.prompt).toBe('plot revenue');
    expect(store.getState().ai.draftPrompt).toBe('');
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(session?.id);

    await cleanup(container, root);
  });

  it('Enter with an existing session starts analysis directly, without creating a new one', async () => {
    const store = createSessionTestStore();
    const {startAnalysis, startAnalysisWhenReady} = stubAnalysisActions(store);
    const sessionId = store.getState().ai.createSession('Existing');
    store.getState().ai.setPrompt(sessionId, 'follow up question');

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <SessionChatComposerProvider>
          <Input />
        </SessionChatComposerProvider>
      </RoomStateProvider>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(startAnalysis).toHaveBeenCalledWith(sessionId);
    expect(startAnalysisWhenReady).not.toHaveBeenCalled();
    expect(store.getState().ai.config.sessions).toHaveLength(1);

    await cleanup(container, root);
  });

  it('send() with no argument on an existing session does not write the prompt; send(text) does', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);
    const sessionId = store.getState().ai.createSession('Existing');
    store.getState().ai.setPrompt(sessionId, 'original prompt');

    const realSetPrompt = store.getState().ai.setPrompt;
    const setPromptSpy = jest.fn<(sessionId: string, value: string) => void>(
      (id, value) => realSetPrompt(id, value),
    );
    store.setState((state) => ({ai: {...state.ai, setPrompt: setPromptSpy}}));

    let composer: Composer | undefined;
    function Reader() {
      composer = useChatComposer();
      return null;
    }

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <SessionChatComposerProvider>
          <Reader />
        </SessionChatComposerProvider>
      </RoomStateProvider>,
    );

    await act(async () => {
      composer!.send();
    });
    expect(setPromptSpy).not.toHaveBeenCalled();
    expect(store.getState().ai.getPrompt(sessionId)).toBe('original prompt');

    await act(async () => {
      composer!.send('override text');
    });
    expect(setPromptSpy).toHaveBeenCalledWith(sessionId, 'override text');
    expect(store.getState().ai.getPrompt(sessionId)).toBe('override text');

    await cleanup(container, root);
  });

  it('Send is absent while running and Stop cancels the session', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);
    const sessionId = store.getState().ai.createSession('Existing');
    store.getState().ai.setPrompt(sessionId, 'hello');
    store.getState().ai.setIsRunning(sessionId, true);

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <SessionChatComposerProvider>
          <Send data-testid="send" />
          <Stop data-testid="stop" />
        </SessionChatComposerProvider>
      </RoomStateProvider>,
    );

    expect(container.querySelector('[data-testid="send"]')).toBeNull();
    const stop = container.querySelector(
      '[data-testid="stop"]',
    ) as HTMLButtonElement;
    expect(stop).not.toBeNull();

    await act(async () => {
      stop.click();
    });

    expect(store.getState().ai.getIsRunning(sessionId)).toBe(false);

    await cleanup(container, root);
  });

  it('Send is disabled with an empty prompt', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);

    const {container, root} = await renderTree(
      <RoomStateProvider roomStore={store}>
        <SessionChatComposerProvider>
          <Send />
        </SessionChatComposerProvider>
      </RoomStateProvider>,
    );

    expect(container.querySelector('button')?.disabled).toBe(true);

    await cleanup(container, root);
  });
});
