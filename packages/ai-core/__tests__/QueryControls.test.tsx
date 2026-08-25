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
  setMockSessionRuntime,
  stubAnalysisActions,
  textarea,
  typeInto,
} from './support';

jest.unstable_mockModule(
  '../src/components/ChatRuntimeContext',
  mockChatRuntimeModule,
);

const {TooltipProvider} = await import('@sqlrooms/ui');
const {DndContext, useDndContext} = await import('@dnd-kit/core');
const {
  LocalAgentChatComposerProvider,
  ChatComposerStateBoundary,
  useChatComposer,
} = await import('../src/components/composer');
const {Item: ChatSuggestionsItem, ChatSuggestionsStateBoundary} =
  await import('../src/components/suggestions');
const {QueryControls} = await import('../src/components/QueryControls');
const {InlineApiKeyInput} = await import('../src/components/InlineApiKeyInput');

describe('QueryControls — unified across runtime modes', () => {
  beforeEach(() => {
    // Session mode by default, as an unmocked tree would be; the local-agent
    // tests install a local-agent runtime themselves.
    setMockSessionRuntime();
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

  it('onRun vetoes a send that originated outside the composer', async () => {
    // The veto is registered on the composer *state*, not wired into the
    // frame's own controls, so it reaches any surface that sends — here a
    // suggestion row that is a sibling of the composer, not a descendant. A
    // policy the composer enforces and a suggestion bypasses is a policy two
    // surfaces disagree about.
    //
    // Both share one boundary, as they do under `Chat.Root`. That also
    // exercises the registry's idempotency: `QueryControls` renders its own
    // boundary internally, which must inherit this one rather than open a
    // second registry that the outer `send` would never consult.
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const onRun = jest.fn<(prompt?: string) => false>(() => false);

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <ChatSuggestionsStateBoundary>
            <QueryControls onRun={onRun} />
            <ChatSuggestionsItem text="plot revenue" submit>
              plot revenue
            </ChatSuggestionsItem>
          </ChatSuggestionsStateBoundary>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    const suggestion = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'plot revenue',
    );
    expect(suggestion).toBeDefined();

    await act(async () => {
      suggestion!.click();
    });

    expect(onRun).toHaveBeenCalledWith('plot revenue');
    expect(startAnalysisWhenReady).not.toHaveBeenCalled();
    expect(store.getState().ai.getCurrentSession()).toBeUndefined();

    await cleanup(container, root);
  });

  it('a send from outside the composer proceeds when onRun does not veto', async () => {
    // The negative control for the test above: without it, a veto assertion
    // would pass just as well if the suggestion never sent at all.
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const onRun = jest.fn<(prompt?: string) => void>(() => {});

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <ChatSuggestionsStateBoundary>
            <QueryControls onRun={onRun} />
            <ChatSuggestionsItem text="plot revenue" submit>
              plot revenue
            </ChatSuggestionsItem>
          </ChatSuggestionsStateBoundary>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    const suggestion = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'plot revenue',
    )!;
    await act(async () => {
      suggestion.click();
    });

    expect(onRun).toHaveBeenCalledWith('plot revenue');
    const session = store.getState().ai.getCurrentSession();
    expect(session?.prompt).toBe('plot revenue');
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(session?.id);

    await cleanup(container, root);
  });

  it('gives the send control an explicit type so it cannot submit an enclosing form', async () => {
    // The recipe substitutes its own `Button` via `asChild`, and that button
    // sets no `type`. Without one injected, an untyped HTML button defaults to
    // `submit`, so clicking send inside a host `<form>` would post the form
    // and lose the draft.
    const store = createSessionTestStore();
    stubAnalysisActions(store);

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls />
        </RoomStateProvider>
      </TooltipProvider>,
    );

    const send = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Send message',
    );
    expect(send).toBeDefined();
    expect(send!.getAttribute('type')).toBe('button');

    await cleanup(container, root);
  });

  it('does not swap to API-key entry when a custom-model factory supplies the model', async () => {
    // `hasResolvableModel()` is true for this app by design. Gating the swap
    // on resolvability alone would newly demand a browser-held key from an app
    // whose credentials live behind its own proxy.
    const store = createSessionTestStore({
      getCustomModel: () => ({}) as never,
    });

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <InlineApiKeyInput onSaveApiKey={() => {}} />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(textarea(container)).not.toBeNull();

    await cleanup(container, root);
  });

  it('honors contextDropTarget in local-agent mode, not only in session mode', async () => {
    // The prop is declared on the shared `QueryControlsProps`, so a host under
    // `Chat.LocalAgentRoot` can pass it and gets no type error. It used to be
    // dropped on the floor there — accepted, ignored, no warning.
    setMockRuntime();
    const droppableIds: string[][] = [];

    /** Reports which droppables dnd-kit currently knows about. */
    function DroppableProbe() {
      const {droppableContainers} = useDndContext();
      droppableIds.push(
        Array.from(droppableContainers.keys()).map((id) => String(id)),
      );
      return null;
    }

    const {container, root} = await renderTree(
      <DndContext>
        <LocalAgentChatComposerProvider>
          <QueryControls
            contextDropTarget={{
              id: 'composer-drop',
              canAccept: () => true,
              onDrop: () => {},
            }}
          />
          <DroppableProbe />
        </LocalAgentChatComposerProvider>
      </DndContext>,
    );

    expect(droppableIds.at(-1)).toContain('composer-drop');

    await cleanup(container, root);
  });

  it('still swaps to API-key entry when a configured factory returns undefined', async () => {
    // The transport falls back to the OpenAI-compatible client in that case,
    // which consumes the settings key — so the key input must stay reachable.
    const store = createSessionTestStore({getCustomModel: () => undefined});

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls>
            <InlineApiKeyInput onSaveApiKey={() => {}} />
          </QueryControls>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    expect(container.querySelector('input[type="password"]')).not.toBeNull();

    await cleanup(container, root);
  });

  it('blocks sends from other surfaces while swapped to API-key entry', async () => {
    // The composer itself has no textarea in this mode, but a suggestion row
    // is a one-click send and would otherwise fire a request with an empty key
    // while the password field is on screen.
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <ChatSuggestionsStateBoundary>
            <QueryControls>
              <InlineApiKeyInput onSaveApiKey={() => {}} />
            </QueryControls>
            <ChatSuggestionsItem text="plot revenue" submit>
              plot revenue
            </ChatSuggestionsItem>
          </ChatSuggestionsStateBoundary>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    // Precondition: the composer really is in credential-entry mode.
    expect(container.querySelector('input[type="password"]')).not.toBeNull();

    const suggestion = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'plot revenue',
    )!;

    // Disabled, not merely inert: a live-looking row that silently does
    // nothing is its own bug.
    expect(suggestion.disabled).toBe(true);

    await act(async () => {
      suggestion.click();
    });

    expect(startAnalysisWhenReady).not.toHaveBeenCalled();
    expect(store.getState().ai.getCurrentSession()).toBeUndefined();

    await cleanup(container, root);
  });

  it('two composers under one root deliberately share one send policy', async () => {
    // Not a fix for the shared-veto report so much as a decision about it: two
    // composers under one root are two views of one chat — same session, same
    // prompt — so a pre-send policy is chat-level and applies to sends from
    // either. Locking that in, because the alternative (scoping onRun to its
    // own composer) is what let a suggestion row bypass onRun entirely.
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const vetoFromFirst = jest.fn<(prompt?: string) => false>(() => false);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <ChatComposerStateBoundary>
            <QueryControls onRun={vetoFromFirst} />
            <QueryControls />
          </ChatComposerStateBoundary>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    // Both composers share the prompt, which is why the policy is shared too.
    const boxes = container.querySelectorAll('textarea');
    expect(boxes.length).toBe(2);

    await act(async () => {
      typeInto(boxes[1]!, 'sent from the second composer');
    });
    await act(async () => {
      fireKeyDown(boxes[1]!);
    });

    // The first composer's veto stopped the second composer's send.
    expect(vetoFromFirst).toHaveBeenCalledWith('sent from the second composer');
    expect(startAnalysisWhenReady).not.toHaveBeenCalled();

    warn.mockRestore();
    await cleanup(container, root);
  });

  it('does not run onRun when the send cannot proceed', async () => {
    // `onRun` exists so a host can create an artifact before the session, so
    // firing it for a send that never happens leaves an orphan. `send` is
    // documented as a no-op when sending isn't possible, and the pre-send
    // handlers have to sit inside that no-op, not ahead of it.
    const runtime = setMockRuntime({prompt: '   ', isStreaming: false});
    const onRun = jest.fn<(prompt?: string) => void>(() => {});

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls onRun={onRun} />
      </LocalAgentChatComposerProvider>,
    );

    // Whitespace-only prompt: not sendable.
    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(onRun).not.toHaveBeenCalled();
    expect(runtime.sendPrompt).not.toHaveBeenCalled();

    await cleanup(container, root);
  });

  it('does not run onRun for a programmatic send while a run is in flight', async () => {
    // The public `useChatComposer().send()` is reachable by hosts and by
    // suggestion rows, so the guard has to live in the composer state rather
    // than in the recipe's own key handler.
    const runtime = setMockRuntime({prompt: 'hello', isStreaming: true});
    const onRun = jest.fn<(prompt?: string) => void>(() => {});
    let programmaticSend: ((text?: string) => void) | undefined;

    function SendProbe() {
      programmaticSend = useChatComposer().send;
      return null;
    }

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls onRun={onRun} />
        <SendProbe />
      </LocalAgentChatComposerProvider>,
    );

    await act(async () => {
      programmaticSend?.('some text');
    });

    expect(onRun).not.toHaveBeenCalled();
    expect(runtime.sendPrompt).not.toHaveBeenCalled();

    await cleanup(container, root);
  });

  it('warns when two composers under one root each register an onRun', async () => {
    // Chat-wide registration is what stops a suggestion bypassing onRun, but it
    // also means two composers share vetoes. Ambiguous rather than composable,
    // so it warns instead of silently merging.
    const store = createSessionTestStore();
    stubAnalysisActions(store);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <ChatComposerStateBoundary>
            <QueryControls onRun={() => {}} />
            <QueryControls onRun={() => {}} />
          </ChatComposerStateBoundary>
        </RoomStateProvider>
      </TooltipProvider>,
    );

    expect(
      warn.mock.calls.some(([msg]) => String(msg).includes("'onRun'")),
    ).toBe(true);

    warn.mockRestore();
    await cleanup(container, root);
  });

  it('does not warn for a single composer with an onRun', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const {container, root} = await renderTree(
      <TooltipProvider>
        <RoomStateProvider roomStore={store}>
          <QueryControls onRun={() => {}} />
        </RoomStateProvider>
      </TooltipProvider>,
    );

    expect(
      warn.mock.calls.some(([msg]) => String(msg).includes("'onRun'")),
    ).toBe(false);

    warn.mockRestore();
    await cleanup(container, root);
  });

  it('follows a bare LocalAgentChatRuntimeProvider with no Chat root', async () => {
    // A documented advanced path: the runtime provider used directly. The
    // boundary must dispatch on the runtime, not assume session mode, or the
    // composer reaches for an AI slice such a store need not have — there is no
    // RoomStateProvider here at all.
    const runtime = setMockRuntime({prompt: 'hello agent'});

    const {container, root} = await renderTree(<QueryControls />);

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(runtime.sendPrompt).toHaveBeenCalledWith();

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
