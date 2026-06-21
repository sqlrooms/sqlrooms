/**
 * @jest-environment jsdom
 */
import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import {TransformStream} from 'node:stream/web';
import {jest} from '@jest/globals';
import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {ChatHistoryView} = await import('../src/components/ChatHistoryView');

function createSession(
  id: string,
  name: string,
  lastOpenedAt: number,
): ChatSessionSchema {
  return {
    id,
    name,
    modelProvider: 'openai',
    model: 'gpt-4.1',
    createdAt: new Date(lastOpenedAt),
    uiMessages: [],
    messagesRevision: 0,
    prompt: '',
    isRunning: false,
    lastOpenedAt,
  };
}

function renderHistory(options?: {
  sessions?: ChatSessionSchema[];
  filterSession?: (session: ChatSessionSchema) => boolean;
  emptyLabel?: string;
  onCreateSession?: () => void;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const createSessionMock = jest.fn();
  const store = createStore<AiSliceState>(() => ({
    ai: {
      config: {
        currentSessionId: 'session-a',
        sessions: options?.sessions ?? [],
      },
      createSession: createSessionMock,
      deleteSession: jest.fn(),
      renameSession: jest.fn(),
    } as unknown as AiSliceState['ai'],
  }));

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatHistoryView
          onBack={jest.fn()}
          onSelectChat={jest.fn()}
          onCreateSession={options?.onCreateSession}
          filterSession={options?.filterSession}
          emptyLabel={options?.emptyLabel}
        />
      </RoomStateProvider>,
    );
  });

  return {container, createSessionMock, root};
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

describe('ChatHistoryView', () => {
  it('filters sessions before rendering history', () => {
    const sessions = [
      createSession('session-a', 'Artifact A chat', 1),
      createSession('session-b', 'Artifact B chat', 2),
    ];
    const {container, root} = renderHistory({
      sessions,
      filterSession: (session) => session.id === 'session-a',
    });

    expect(container.textContent).toContain('Artifact A chat');
    expect(container.textContent).not.toContain('Artifact B chat');

    cleanup(container, root);
  });

  it('uses custom empty label and create callback', () => {
    const onCreateSession = jest.fn();
    const {container, createSessionMock, root} = renderHistory({
      sessions: [createSession('session-a', 'Artifact A chat', 1)],
      filterSession: () => false,
      emptyLabel: 'No chats for this artifact yet',
      onCreateSession,
    });

    expect(container.textContent).toContain('No chats for this artifact yet');

    act(() => {
      const createButton = Array.from(
        container.querySelectorAll('button'),
      ).find((button) =>
        button.textContent?.includes('Create your first chat'),
      );
      createButton?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(createSessionMock).not.toHaveBeenCalled();

    cleanup(container, root);
  });
});
