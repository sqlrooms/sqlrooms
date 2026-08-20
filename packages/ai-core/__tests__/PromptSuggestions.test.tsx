/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {createRoot, type Root as ReactRoot} from 'react-dom/client';
import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  RoomStateProvider,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import {TextEncoder, TextDecoder} from 'node:util';
import type {AiSliceState} from '../src/AiSlice';
import type {LocalAgentChatRuntime} from '../src/components/ChatRuntimeContext';

Object.assign(globalThis, {
  TransformStream,
  TextEncoder,
  TextDecoder,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
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

const {TooltipProvider} = await import('@sqlrooms/ui');
const {createAiSlice} = await import('../src/AiSlice');
const {SessionChatComposerProvider, LocalAgentChatComposerProvider} =
  await import('../src/components/composer');
const {
  SessionChatSuggestionsProvider,
  LocalAgentChatSuggestionsProvider,
  Root,
  Item,
  VisibilityToggle,
  Dismiss,
} = await import('../src/components/suggestions');
const {PromptSuggestions} = await import('../src/components/PromptSuggestions');

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

async function cleanup(container: HTMLElement, root: ReactRoot) {
  await act(async () => root.unmount());
  container.remove();
}

function SessionTree({
  children,
  store,
}: {
  children: React.ReactNode;
  store: SessionTestStore;
}) {
  return (
    <RoomStateProvider roomStore={store}>
      <SessionChatComposerProvider>
        <SessionChatSuggestionsProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionChatSuggestionsProvider>
      </SessionChatComposerProvider>
    </RoomStateProvider>
  );
}

function LocalAgentTree({children}: {children: React.ReactNode}) {
  return (
    <LocalAgentChatComposerProvider>
      <LocalAgentChatSuggestionsProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </LocalAgentChatSuggestionsProvider>
    </LocalAgentChatComposerProvider>
  );
}

describe('suggestions primitives — position-agnostic wiring', () => {
  it('a list rendered outside the composer subtree responds to a toggle rendered inside it', async () => {
    const store = createSessionTestStore();
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <div data-testid="list-region">
          <Root>
            <Item text="Suggestion A" data-testid="item" />
          </Root>
        </div>
        <div data-testid="footer-region">
          <VisibilityToggle data-testid="toggle" />
        </div>
      </SessionTree>,
    );

    expect(container.querySelector('[data-testid="item"]')).not.toBeNull();

    await act(async () => {
      (
        container.querySelector('[data-testid="toggle"]') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[data-testid="item"]')).toBeNull();

    await act(async () => {
      (
        container.querySelector('[data-testid="toggle"]') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[data-testid="item"]')).not.toBeNull();

    await cleanup(container, root);
  });
});

describe('suggestions primitives — controlled `open`', () => {
  it('open={false} hides the list even when store visibility is true', async () => {
    const store = createSessionTestStore();
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Root open={false} data-testid="root">
          <Item text="Suggestion A" />
        </Root>
      </SessionTree>,
    );

    expect(store.getState().ai.promptSuggestionsVisible).toBe(true);
    expect(container.querySelector('[data-testid="root"]')).toBeNull();

    await cleanup(container, root);
  });

  it('open={true} shows the list even when store visibility is false', async () => {
    const store = createSessionTestStore();
    store.getState().ai.setPromptSuggestionsVisible(false);
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Root open={true} data-testid="root">
          <Item text="Suggestion A" />
        </Root>
      </SessionTree>,
    );

    expect(container.querySelector('[data-testid="root"]')).not.toBeNull();

    await cleanup(container, root);
  });
});

describe('suggestions primitives — Item activation', () => {
  it('fills the draft prompt by default, without creating a session', async () => {
    const store = createSessionTestStore();
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Item text="Show revenue by month" />
      </SessionTree>,
    );

    await act(async () => {
      container.querySelector('button')!.click();
    });

    expect(store.getState().ai.getCurrentSession()).toBeUndefined();
    expect(store.getState().ai.draftPrompt).toBe('Show revenue by month');

    await cleanup(container, root);
  });

  it('submit sends immediately, creating a session with the suggestion text', async () => {
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Item text="Show revenue by month" submit />
      </SessionTree>,
    );

    await act(async () => {
      container.querySelector('button')!.click();
    });

    const session = store.getState().ai.getCurrentSession();
    expect(session).toBeDefined();
    expect(session?.prompt).toBe('Show revenue by month');
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(session?.id);

    await cleanup(container, root);
  });

  it('is disabled when sending is not possible (a run in flight)', async () => {
    const store = createSessionTestStore();
    stubAnalysisActions(store);
    const sessionId = store.getState().ai.createSession('Existing');
    store.getState().ai.setIsRunning(sessionId, true);

    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Item text="Show revenue by month" />
      </SessionTree>,
    );

    expect(container.querySelector('button')!.disabled).toBe(true);

    await cleanup(container, root);
  });

  it('local-agent mode: is disabled while streaming', async () => {
    mockRuntime = createMockLocalAgentRuntime({isStreaming: true});
    const {container, root} = await renderTree(
      <LocalAgentTree>
        <Item text="Show revenue by month" />
      </LocalAgentTree>,
    );

    expect(container.querySelector('button')!.disabled).toBe(true);

    await cleanup(container, root);
  });

  it('local-agent mode: fills by default and submits when opted in', async () => {
    mockRuntime = createMockLocalAgentRuntime();
    const fillRender = await renderTree(
      <LocalAgentTree>
        <Item text="Show revenue by month" />
      </LocalAgentTree>,
    );
    await act(async () => {
      fillRender.container.querySelector('button')!.click();
    });
    expect(mockRuntime.setPrompt).toHaveBeenCalledWith('Show revenue by month');
    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(fillRender.container, fillRender.root);

    mockRuntime = createMockLocalAgentRuntime();
    const submitRender = await renderTree(
      <LocalAgentTree>
        <Item text="Show revenue by month" submit />
      </LocalAgentTree>,
    );
    await act(async () => {
      submitRender.container.querySelector('button')!.click();
    });
    expect(mockRuntime.sendPrompt).toHaveBeenCalledWith(
      'Show revenue by month',
    );
    await cleanup(submitRender.container, submitRender.root);
  });
});

describe('suggestions primitives — Dismiss', () => {
  it('hides the list', async () => {
    const store = createSessionTestStore();
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Root>
          <Item text="Suggestion A" data-testid="item" />
        </Root>
        <Dismiss data-testid="dismiss" />
      </SessionTree>,
    );

    expect(container.querySelector('[data-testid="item"]')).not.toBeNull();

    await act(async () => {
      (
        container.querySelector('[data-testid="dismiss"]') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[data-testid="item"]')).toBeNull();
    expect(store.getState().ai.promptSuggestionsVisible).toBe(false);

    await cleanup(container, root);
  });
});

describe('suggestions primitives — a horizontal layout is still expressible', () => {
  it('builds a horizontal scrolling carousel from the primitives, unstyled by SQLRooms', async () => {
    const store = createSessionTestStore();
    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <Root className="flex gap-2 overflow-x-auto">
          <Item
            text="First suggestion"
            className="w-48 shrink-0"
            data-testid="item-1"
          />
          <Item
            text="Second suggestion"
            className="w-48 shrink-0"
            data-testid="item-2"
          />
        </Root>
      </SessionTree>,
    );

    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.className).toContain('overflow-x-auto');
    const item1 = container.querySelector(
      '[data-testid="item-1"]',
    ) as HTMLElement;
    expect(item1.className).toContain('w-48');
    expect(container.querySelector('[data-testid="item-2"]')).not.toBeNull();

    await cleanup(container, root);
  });
});

describe('recipe — Chat.PromptSuggestions (the new vertical default)', () => {
  it('session mode: renders host children in full, submits on click, and dismiss hides the list', async () => {
    const store = createSessionTestStore();
    const {startAnalysisWhenReady} = stubAnalysisActions(store);
    const longText =
      'This is a deliberately long suggestion that exceeds forty characters easily';
    expect(longText.length).toBeGreaterThan(40);

    const {container, root} = await renderTree(
      <SessionTree store={store}>
        <PromptSuggestions>
          <PromptSuggestions.Item text={longText} />
        </PromptSuggestions>
      </SessionTree>,
    );

    // Not truncated at a character count — the full text is in the DOM.
    expect(container.textContent).toContain(longText);

    await act(async () => {
      container.querySelector('button[title]')!.click();
    });
    const session = store.getState().ai.getCurrentSession();
    expect(session).toBeDefined();
    expect(session?.prompt).toBe(longText);
    expect(startAnalysisWhenReady).toHaveBeenCalledWith(session?.id);

    const dismissButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Hide prompt suggestions',
    );
    expect(dismissButton).toBeDefined();
    await act(async () => {
      dismissButton!.click();
    });
    expect(store.getState().ai.promptSuggestionsVisible).toBe(false);
    expect(container.textContent).not.toContain(longText);

    await cleanup(container, root);
  });

  it('local-agent mode: auto-renders runtime-supplied items with no children', async () => {
    mockRuntime = createMockLocalAgentRuntime({
      initialSuggestions: ['What does this data show?'],
    });

    const {container, root} = await renderTree(
      <LocalAgentTree>
        <PromptSuggestions />
      </LocalAgentTree>,
    );

    expect(container.textContent).toContain('What does this data show?');

    await act(async () => {
      container.querySelector('button[title]')!.click();
    });
    expect(mockRuntime.sendPrompt).toHaveBeenCalledWith(
      'What does this data show?',
    );

    await cleanup(container, root);
  });

  it('local-agent mode: renders with no AI slice present and does not throw', async () => {
    mockRuntime = createMockLocalAgentRuntime({
      initialSuggestions: ['Suggestion without a store'],
    });

    let caught: unknown;
    try {
      const {container, root} = await renderTree(
        <LocalAgentTree>
          <PromptSuggestions />
        </LocalAgentTree>,
      );
      expect(container.textContent).toContain('Suggestion without a store');
      await cleanup(container, root);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeUndefined();
  });
});
