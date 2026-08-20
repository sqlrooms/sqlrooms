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
import {createRoot, type Root} from 'react-dom/client';
import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  RoomStateProvider,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import {TransformStream} from 'node:stream/web';
import {TextEncoder, TextDecoder} from 'node:util';
import type {AiSliceState} from '../src/AiSlice';
import type {LocalAgentChatRuntime} from '../src/components/ChatRuntimeContext';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  TransformStream,
  TextEncoder,
  TextDecoder,
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

function createMockLocalAgentRuntime(
  overrides: Partial<LocalAgentChatRuntime> = {},
): LocalAgentChatRuntime {
  return {
    mode: 'local-agent',
    messages: [],
    status: 'ready',
    isStreaming: false,
    prompt: '',
    setPrompt: jest.fn<(value: string) => void>(),
    sendPrompt: jest.fn<(value?: string) => void>(),
    stop: jest.fn<() => Promise<void>>(async () => {}),
    initialSuggestions: [],
    suggestionsVisible: true,
    setSuggestionsVisible: jest.fn<(visible: boolean) => void>(),
    ...overrides,
  };
}

let mockRuntime: LocalAgentChatRuntime = createMockLocalAgentRuntime();

jest.unstable_mockModule('../src/components/ChatRuntimeContext', () => ({
  useChatRuntime: () => mockRuntime,
}));

const {createAiSlice} = await import('../src/AiSlice');
const {LocalAgentChatComposerProvider} =
  await import('../src/components/composer');
const {QueryControls} = await import('../src/components/QueryControls');
const {InlineApiKeyInput} = await import('../src/components/InlineApiKeyInput');

type TestState = BaseRoomStoreState & AiSliceState;

function createSessionTestStore() {
  return createStore<TestState>()((set, get, storeApi) => ({
    ...createBaseRoomSlice()(set, get, storeApi),
    ...createAiSlice({
      tools: {},
      getInstructions: () => 'test instructions',
      config: {sessions: []},
    })(set, get, storeApi),
  }));
}

type SessionTestStore = ReturnType<typeof createSessionTestStore>;

function stubAnalysisActions(store: SessionTestStore) {
  const startAnalysis = jest.fn<(sessionId: string) => Promise<void>>(
    async () => {},
  );
  const startAnalysisWhenReady = jest.fn<
    (sessionId: string) => Promise<boolean>
  >(async () => true);
  store.setState((state) => ({
    ai: {...state.ai, startAnalysis, startAnalysisWhenReady},
  }));
  return {startAnalysis, startAnalysisWhenReady};
}

async function renderTree(node: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return {container, root};
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

function textarea(container: HTMLElement) {
  return container.querySelector('textarea');
}

function typeInto(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', {bubbles: true}));
}

function fireEnter(el: Element) {
  el.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('QueryControls — unified across runtime modes', () => {
  beforeEach(() => {
    mockRuntime = createMockLocalAgentRuntime();
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
      fireEnter(textarea(container)!);
    });

    const session = store.getState().ai.getCurrentSession();
    expect(session?.prompt).toBe('plot revenue');
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(session?.id);

    await cleanup(container, root);
  });

  it('sends in local-agent mode', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello agent'});

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls />
      </LocalAgentChatComposerProvider>,
    );

    await act(async () => {
      fireEnter(textarea(container)!);
    });

    expect(mockRuntime.sendPrompt).toHaveBeenCalledWith(undefined);

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
      fireEnter(textarea(container)!);
    });

    expect(onRun).toHaveBeenCalledWith('do not send this');
    expect(startAnalysisWhenReady).not.toHaveBeenCalled();
    expect(store.getState().ai.getCurrentSession()).toBeUndefined();

    await cleanup(container, root);
  });

  it('onRun returning false vetoes the send in local-agent mode', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'do not send this'});
    const onRun = jest.fn<(prompt?: string) => false>(() => false);

    const {container, root} = await renderTree(
      <LocalAgentChatComposerProvider>
        <QueryControls onRun={onRun} />
      </LocalAgentChatComposerProvider>,
    );

    await act(async () => {
      fireEnter(textarea(container)!);
    });

    expect(onRun).toHaveBeenCalledWith('do not send this');
    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();

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
    mockRuntime = createMockLocalAgentRuntime();

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
