/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import React, {act, createRef, forwardRef} from 'react';
import type {ComponentProps} from 'react';
import {createRoot, type Root} from 'react-dom/client';
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

/** Flushes the auto-resize hook's per-frame `requestAnimationFrame` batching. */
async function flushAutoResizeFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

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

const {Slot} = await import('@sqlrooms/ui');
const {createAiSlice} = await import('../src/AiSlice');
const {
  useChatComposer,
  SessionChatComposerProvider,
  LocalAgentChatComposerProvider,
  ChatComposerStateBoundary,
  Input,
  Send,
  Stop,
} = await import('../src/components/composer');

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

/** Replaces the two heavy, network-touching actions with spies so tests can
 * assert on session-creation and run-triggering behavior without exercising
 * the real model/transport pipeline. */
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

async function rerenderTree(root: Root, node: React.ReactElement) {
  await act(async () => {
    root.render(node);
  });
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

function textarea(container: HTMLElement) {
  return container.querySelector('textarea');
}

function fireKeyDown(
  el: Element,
  init: Partial<KeyboardEventInit> & {keyCode?: number} = {},
) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (init.keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', {get: () => init.keyCode});
  }
  el.dispatchEvent(event);
}

describe('composer primitives — local-agent mode', () => {
  beforeEach(() => {
    mockRuntime = createMockLocalAgentRuntime();
  });

  function LocalAgentComposer(props: {children: React.ReactNode}) {
    return (
      <LocalAgentChatComposerProvider>
        {props.children}
      </LocalAgentChatComposerProvider>
    );
  }

  it('sends on Enter with no modifiers', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input />
      </LocalAgentComposer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(mockRuntime.sendPrompt).toHaveBeenCalledWith(undefined);
    await cleanup(container, root);
  });

  it('does not send on Shift+Enter', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input />
      </LocalAgentComposer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!, {shiftKey: true});
    });

    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('does not send while an IME composition is active', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input />
      </LocalAgentComposer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!, {isComposing: true});
    });
    await act(async () => {
      fireKeyDown(textarea(container)!, {keyCode: 229});
    });

    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('does not send and does not cancel on Enter while a run is in flight', async () => {
    mockRuntime = createMockLocalAgentRuntime({
      prompt: 'hello',
      isStreaming: true,
    });
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input />
      </LocalAgentComposer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
    expect(mockRuntime.stop).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('submitOnEnter={false} disables the keymap', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input submitOnEnter={false} />
      </LocalAgentComposer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('a host onKeyDown calling preventDefault suppresses submission', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const hostOnKeyDown = jest.fn((event: React.KeyboardEvent) => {
      event.preventDefault();
    });
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input onKeyDown={hostOnKeyDown} />
      </LocalAgentComposer>,
    );

    await act(async () => {
      fireKeyDown(textarea(container)!);
    });

    expect(hostOnKeyDown).toHaveBeenCalled();
    expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('Send is disabled with an empty prompt', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: '  '});
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Send />
      </LocalAgentComposer>,
    );

    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
    await cleanup(container, root);
  });

  it('Send is absent while running; Stop is absent while idle', async () => {
    mockRuntime = createMockLocalAgentRuntime({
      prompt: 'hello',
      isStreaming: false,
    });
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Send data-testid="send" />
        <Stop data-testid="stop" />
      </LocalAgentComposer>,
    );

    expect(container.querySelector('[data-testid="send"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stop"]')).toBeNull();

    mockRuntime = createMockLocalAgentRuntime({
      prompt: 'hello',
      isStreaming: true,
    });
    await rerenderTree(
      root,
      <LocalAgentComposer>
        <Send data-testid="send" />
        <Stop data-testid="stop" />
      </LocalAgentComposer>,
    );

    expect(container.querySelector('[data-testid="send"]')).toBeNull();
    expect(container.querySelector('[data-testid="stop"]')).not.toBeNull();

    await cleanup(container, root);
  });

  it('Stop cancels on activation and is never disabled', async () => {
    mockRuntime = createMockLocalAgentRuntime({isStreaming: true});
    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Stop />
      </LocalAgentComposer>,
    );

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
    });
    expect(mockRuntime.stop).toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('asChild substitution delivers activation and disabled state to a stub component', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const onActivate =
      jest.fn<(event: React.MouseEvent<HTMLButtonElement>) => void>();
    const StubButton = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
      function StubButton(props, ref) {
        return <button ref={ref} data-testid="stub-button" {...props} />;
      },
    );

    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Send asChild onClick={onActivate}>
          <StubButton />
        </Send>
      </LocalAgentComposer>,
    );

    const stub = container.querySelector(
      '[data-testid="stub-button"]',
    ) as HTMLButtonElement;
    expect(stub.disabled).toBe(false);
    await act(async () => {
      stub.click();
    });
    expect(onActivate).toHaveBeenCalled();
    expect(mockRuntime.sendPrompt).toHaveBeenCalled();
    await cleanup(container, root);
  });

  it('nested asChild composes ref and click through two Slot layers', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
    const outerRef = createRef<HTMLButtonElement>();
    const onOuterClick =
      jest.fn<(event: React.MouseEvent<HTMLButtonElement>) => void>();
    const onStubClick =
      jest.fn<(event: React.MouseEvent<HTMLButtonElement>) => void>();
    const StubButton = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
      function StubButton(props, ref) {
        return <button ref={ref} data-testid="stub-send" {...props} />;
      },
    );

    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Slot ref={outerRef}>
          <Send asChild onClick={onOuterClick}>
            <StubButton onClick={onStubClick} />
          </Send>
        </Slot>
      </LocalAgentComposer>,
    );

    const stub = container.querySelector(
      '[data-testid="stub-send"]',
    ) as HTMLButtonElement;
    expect(outerRef.current).toBe(stub);

    await act(async () => {
      stub.click();
    });

    expect(onStubClick).toHaveBeenCalled();
    expect(onOuterClick).toHaveBeenCalled();
    expect(mockRuntime.sendPrompt).toHaveBeenCalled();

    await cleanup(container, root);
  });

  it('auto-resize applies to a substituted textarea; autoResize={false} leaves height unmanaged', async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hello\nworld'});
    const StubTextarea = forwardRef<
      HTMLTextAreaElement,
      ComponentProps<'textarea'>
    >(function StubTextarea(props, ref) {
      return <textarea ref={ref} data-testid="stub-textarea" {...props} />;
    });

    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 123,
    });

    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input asChild>
          <StubTextarea />
        </Input>
      </LocalAgentComposer>,
    );

    await flushAutoResizeFrame();
    const stub = container.querySelector(
      '[data-testid="stub-textarea"]',
    ) as HTMLTextAreaElement;
    expect(stub.style.height).toBe('123px');
    await cleanup(container, root);

    const {container: container2, root: root2} = await renderTree(
      <LocalAgentComposer>
        <Input asChild autoResize={false}>
          <StubTextarea />
        </Input>
      </LocalAgentComposer>,
    );
    await flushAutoResizeFrame();
    const stub2 = container2.querySelector(
      '[data-testid="stub-textarea"]',
    ) as HTMLTextAreaElement;
    expect(stub2.style.height).toBe('');
    await cleanup(container2, root2);
  });

  it("a host's own ref on Input still receives the element while auto-resize also works", async () => {
    mockRuntime = createMockLocalAgentRuntime({prompt: 'hi'});
    const hostRef = createRef<HTMLTextAreaElement>();
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 77,
    });

    const {container, root} = await renderTree(
      <LocalAgentComposer>
        <Input ref={hostRef} />
      </LocalAgentComposer>,
    );

    await flushAutoResizeFrame();
    const el = textarea(container)!;
    expect(hostRef.current).toBe(el);
    expect(el.style.height).toBe('77px');
    await cleanup(container, root);
  });

  describe('onBeforeSend', () => {
    it('Input: returning false on Enter prevents the send', async () => {
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const onBeforeSend = jest.fn<(text: string) => boolean>(() => false);
      const {container, root} = await renderTree(
        <LocalAgentComposer>
          <Input onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );

      await act(async () => {
        fireKeyDown(textarea(container)!);
      });

      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
      await cleanup(container, root);
    });

    it('Input: returning undefined or true on Enter allows the send', async () => {
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const onBeforeSend = jest.fn<(text: string) => boolean | void>(
        () => undefined,
      );
      const {container, root} = await renderTree(
        <LocalAgentComposer>
          <Input onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );

      await act(async () => {
        fireKeyDown(textarea(container)!);
      });

      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      expect(onBeforeSend).toHaveBeenCalledWith('hello');
      expect(mockRuntime.sendPrompt).toHaveBeenCalledWith(undefined);
      await cleanup(container, root);
    });

    it('Input: not called when an earlier guard already rejects the keystroke', async () => {
      const onBeforeSend = jest.fn<(text: string) => boolean>(() => true);

      // IME composition active.
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const composing = await renderTree(
        <LocalAgentComposer>
          <Input onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );
      await act(async () => {
        fireKeyDown(textarea(composing.container)!, {isComposing: true});
      });
      await cleanup(composing.container, composing.root);
      expect(onBeforeSend).not.toHaveBeenCalled();

      // A modifier is held.
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const shiftHeld = await renderTree(
        <LocalAgentComposer>
          <Input onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );
      await act(async () => {
        fireKeyDown(textarea(shiftHeld.container)!, {shiftKey: true});
      });
      await cleanup(shiftHeld.container, shiftHeld.root);
      expect(onBeforeSend).not.toHaveBeenCalled();

      // submitOnEnter is off.
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const noSubmitOnEnter = await renderTree(
        <LocalAgentComposer>
          <Input submitOnEnter={false} onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );
      await act(async () => {
        fireKeyDown(textarea(noSubmitOnEnter.container)!);
      });
      await cleanup(noSubmitOnEnter.container, noSubmitOnEnter.root);
      expect(onBeforeSend).not.toHaveBeenCalled();

      // canSend is false (empty prompt).
      mockRuntime = createMockLocalAgentRuntime({prompt: '   '});
      const emptyPrompt = await renderTree(
        <LocalAgentComposer>
          <Input onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );
      await act(async () => {
        fireKeyDown(textarea(emptyPrompt.container)!);
      });
      await cleanup(emptyPrompt.container, emptyPrompt.root);
      expect(onBeforeSend).not.toHaveBeenCalled();
    });

    it('Send: returning false on activation prevents the send', async () => {
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const onBeforeSend = jest.fn<(text: string) => boolean>(() => false);
      const {container, root} = await renderTree(
        <LocalAgentComposer>
          <Send onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );

      const button = container.querySelector('button')!;
      await act(async () => {
        button.click();
      });

      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
      await cleanup(container, root);
    });

    it('Send: returning undefined or true on activation allows the send', async () => {
      mockRuntime = createMockLocalAgentRuntime({prompt: 'hello'});
      const onBeforeSend = jest.fn<(text: string) => boolean | void>(
        () => true,
      );
      const {container, root} = await renderTree(
        <LocalAgentComposer>
          <Send onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );

      const button = container.querySelector('button')!;
      await act(async () => {
        button.click();
      });

      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      expect(onBeforeSend).toHaveBeenCalledWith('hello');
      expect(mockRuntime.sendPrompt).toHaveBeenCalled();
      await cleanup(container, root);
    });

    it('Send: not called when canSend is false (button disabled, click is a no-op)', async () => {
      mockRuntime = createMockLocalAgentRuntime({prompt: '   '});
      const onBeforeSend = jest.fn<(text: string) => boolean>(() => true);
      const {container, root} = await renderTree(
        <LocalAgentComposer>
          <Send onBeforeSend={onBeforeSend} />
        </LocalAgentComposer>,
      );

      const button = container.querySelector('button')!;
      expect(button.disabled).toBe(true);
      await act(async () => {
        button.click();
      });

      expect(onBeforeSend).not.toHaveBeenCalled();
      expect(mockRuntime.sendPrompt).not.toHaveBeenCalled();
      await cleanup(container, root);
    });
  });
});

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
    expect((caught as Error).message.length).toBeGreaterThan(0);
    expect((caught as Error).message).toMatch(/Chat/);

    consoleError.mockRestore();
    await cleanup(container, root);
  });

  it('ChatComposerStateBoundary supplies working session-mode state with no other provider', async () => {
    const store = createSessionTestStore();
    let seen: ReturnType<typeof useChatComposer> | undefined;
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

    // Use the native value setter so React's synthetic `onChange` (bound to
    // a native `input` event under the hood) fires for this controlled
    // textarea, matching how a real keystroke updates a controlled input.
    await act(async () => {
      const el = textarea(container)!;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )!.set!;
      setter.call(el, 'plot revenue');
      el.dispatchEvent(new Event('input', {bubbles: true}));
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
    store.setState((state) => ({
      ai: {...state.ai, setPrompt: setPromptSpy},
    }));

    let composer: ReturnType<typeof useChatComposer> | undefined;
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

    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);

    await cleanup(container, root);
  });
});
