/**
 * @jest-environment jsdom
 */
import React, {act} from 'react';
import {jest} from '@jest/globals';
import {createRoot, type Root} from 'react-dom/client';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import {TransformStream} from 'node:stream/web';
import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import type {AiSliceState} from '../src/AiSlice';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  TransformStream,
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  },
  cancelAnimationFrame: () => {},
});

const {ChatMessagesContainer} =
  await import('../src/components/ChatMessagesContainer');

function renderMessages({isRunning = false}: {isRunning?: boolean} = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const session: ChatSessionSchema = {
    id: 'session-1',
    name: 'Test chat',
    modelProvider: 'openai',
    model: 'gpt-4.1',
    createdAt: new Date(),
    uiMessages: [],
    messagesRevision: 0,
    prompt: '',
    isRunning,
  };
  const store = createStore<AiSliceState>(() => ({
    ai: {
      config: {
        currentSessionId: session.id,
        sessions: [session],
        sessionForks: {},
      },
      getCurrentSession: () => session,
      getSessionForkOrigin: () => undefined,
      getIsRunning: () => isRunning,
      switchSession: jest.fn(),
    } as unknown as AiSliceState['ai'],
  }));

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatMessagesContainer />
      </RoomStateProvider>,
    );
  });

  return {container, root};
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

describe('ChatMessagesContainer', () => {
  it('uses native scrolling and updates the scroll-to-bottom button state', () => {
    const {container, root} = renderMessages();
    const scrollContainer = container.querySelector<HTMLDivElement>(
      '.scrollbar-thin.overflow-y-auto',
    );
    const scrollButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Scroll to bottom"]',
    );

    expect(scrollContainer).not.toBeNull();
    expect(scrollButton).not.toBeNull();

    let scrollTop = 0;
    Object.defineProperties(scrollContainer!, {
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      },
      scrollHeight: {configurable: true, value: 1_000},
      clientHeight: {configurable: true, value: 300},
    });
    const scrollTo = jest.fn(({top}: ScrollToOptions) => {
      scrollTop = Math.min(Number(top), 700);
      scrollContainer!.dispatchEvent(new Event('scroll'));
    });
    Object.defineProperty(scrollContainer!, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    act(() => {
      scrollContainer!.dispatchEvent(new Event('scroll'));
    });

    expect(scrollButton!.classList.contains('opacity-100')).toBe(true);

    act(() => {
      scrollButton!.click();
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1_000,
      behavior: 'smooth',
    });
    expect(scrollTop).toBe(700);
    expect(scrollButton!.classList.contains('opacity-0')).toBe(true);

    cleanup(container, root);
  });

  it('shows animated dots instead of the chevron while chat is running', () => {
    const scrollTo = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    const {container, root} = renderMessages({isRunning: true});
    const scrollButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Scroll to bottom"]',
    );

    expect(scrollButton?.querySelectorAll('.animate-bounce')).toHaveLength(3);
    expect(scrollButton?.querySelector('.lucide-chevron-down')).toBeNull();

    cleanup(container, root);
  });
});
