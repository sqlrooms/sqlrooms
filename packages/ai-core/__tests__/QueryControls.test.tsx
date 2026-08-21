/**
 * @jest-environment jsdom
 *
 * Component-seam tests for the Phase 4 rewrite of `QueryControls`: it must be
 * a single implementation built on `useChatComposer()` and the composer
 * primitives that serves both runtime modes, keeps session-only chrome out
 * of local-agent mode, and works with no `<Chat>` ancestor at all.
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
  setMockRuntime,
  stubAnalysisActions,
  textarea,
  typeInto,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {TooltipProvider} = await import('@sqlrooms/ui');
const {LocalAgentChatComposerProvider} =
  await import('../src/components/composer');
const {QueryControls} = await import('../src/components/QueryControls');
const {InlineApiKeyInput} = await import('../src/components/InlineApiKeyInput');

describe('QueryControls — unified across runtime modes', () => {
  beforeEach(() => {
    setMockRuntime();
  });

  it('sends in session mode', async () => {
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls />
        </RoomStateProvider>
      </TooltipProvider>,
    );

    await act(async () => {
      typeInto(textarea(container)!, 'plot revenue');
    });
    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    const session = store.getState().ai.getCurrentSession();
    expect(session?.prompt).toBe('plot revenue');
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(session?.id);

    await cleanup(container, root);
  });

  it('sends in local-agent mode', async () => {
    const runtime = setMockRuntime({prompt: 'hello agent'});

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls />
      </LocalAgentChatComposerProvider>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    // No argument: `send()` sends whatever the prompt currently holds.
    expect(runtime.sendPrompt).toHaveBeenCalledWith();

    await cleanup(container, root);
  });

  it('onRun returning false vetoes the send in session mode', async () => {
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const onRun = jest.fn<(prompt?: string) => false>(() => false);

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls onRun={onRun} />
        </RoomStateProvider>
      </TooltipProvider>,
    );

    await act(async () => {
      typeInto(textarea(container)!, 'do not send this');
    });
    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(onRun).toHaveBeenCalledWith('do not send this');
    expect(startAnalysisWhenReady).not.toHaveBeenCalled();
    expect(store.getState().ai.getCurrentSession()).toBeUndefined();

    await cleanup(container, root);
  });

  it('onRun returning false vetoes the send in local-agent mode', async () => {
    const runtime = setMockRuntime({prompt: 'do not send this'});
    const onRun = jest.fn<(prompt?: string) => false>(() => false);

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls onRun={onRun} />
      </LocalAgentChatComposerProvider>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(onRun).toHaveBeenCalledWith('do not send this');
    expect(runtime.sendPrompt).not.toHaveBeenCalled();

    await cleanup(container, root);
  });

  it('renders with no <Chat> ancestor at all (defaults to session mode)', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls />
        </RoomStateProvider>
      </TooltipProvider>,
    );

    expect(textarea(container)).not.toBeNull();
    expect(textarea(container)!.getAttribute('placeholder')).toBe(
      'What would you like to learn about the data?',
    );

    await cleanup(container, root);
  });

  it('session-only chrome is absent in local-agent mode and nothing throws', async () => {
    setMockRuntime();

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls>
          <span data-testid="footer-chip">a footer chip</span>
        </QueryControls>
      </LocalAgentChatComposerProvider>,
    );

    // No API-key mode swap, no context-usage indicator, no summarizing
    // overlay — none of these are session concepts in local-agent mode, and
    // none of them ever touch the AI slice while rendering here.
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.textContent?.includes('Summarizing conversation')).toBe(
      false,
    );
    expect(
      Array.from(container.querySelectorAll('button')).some((btn) =>
        btn.getAttribute('aria-label')?.includes('context used'),
      ),
    ).toBe(false);
    expect(
      container.querySelector('[data-testid="footer-chip"]'),
    ).not.toBeNull();
    expect(textarea(container)).not.toBeNull();

    await cleanup(container, root);
  });

  it('session mode still renders the context-usage indicator (frozen recipe)', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);
    const sessionId = store.getState().ai.createSession('S');
    store.setState((s) => ({
      ai: {
        ...s.ai,
        config: {
          ...s.ai.config,
          sessions: s.ai.config.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  uiMessages: [
                    {
                      id: 'm1',
                      role: 'user',
                      parts: [
                        {
                          type: 'text',
                          text: 'a long enough message to register non-zero estimated token usage for the context indicator',
                        },
                      ],
                    },
                  ] as any,
                }
              : session,
          ),
        },
      },
    }));

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls />
        </RoomStateProvider>
      </TooltipProvider>,
    );

    // The context-usage indicator renders as a button with a percentage/
    // token-count aria-label once there is any estimated usage.
    const indicator = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label')?.includes('context used'),
    );
    expect(indicator).toBeDefined();

    await cleanup(container, root);
  });

  it('session mode still performs the inline API-key mode swap (frozen recipe)', async () => {
    const store = createSessionTestStore();

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <InlineApiKeyInput onSaveApiKey={() => {}} />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    // No API key configured: the composer swaps to the inline API-key entry
    // mode instead of the normal prompt textarea.
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(textarea(container)).toBeNull();

    await cleanup(container, root);
  });
});
