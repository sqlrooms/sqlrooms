/**
 * @jest-environment jsdom
 */
import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createStore} from 'zustand';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {DefaultChatReasoning} =
  await import('../src/components/defaultChatRendering');
const {
  ChatSearchProvider,
  useChatSearch,
  useRegisterChatSearchBlocks,
  useReportRenderedChatSearchBlock,
} = await import('../src/components/ChatSearch');

const REASONING_BLOCK_ID = 'session-1:result-1:reasoning:0';
const OTHER_BLOCK_ID = 'session-1:result-1:text:0';

// Stands in for a sibling text block that is actually on screen, so it
// participates in the rendered-set intersection alongside the reasoning
// block under test.
function OtherBlockReporter() {
  useReportRenderedChatSearchBlock(OTHER_BLOCK_ID);
  return null;
}

function createTestStore(sessionId = 'session-1') {
  return createStore<AiSliceState>(
    () =>
      ({
        ai: {
          config: {
            currentSessionId: sessionId,
          },
        },
      }) as unknown as AiSliceState,
  ) as any;
}

// Registers both blocks so a query can match either one, mirroring how
// ChatTurnView registers reasoning and text blocks side by side.
function BlockRegistrar() {
  useRegisterChatSearchBlocks('turn-1', [
    {
      id: REASONING_BLOCK_ID,
      resultId: 'result-1',
      text: 'thinking about design carefully',
    },
    {
      id: OTHER_BLOCK_ID,
      resultId: 'result-1',
      text: 'a design summary elsewhere',
    },
  ]);
  return null;
}

const latestSearchRef: {
  current: ReturnType<typeof useChatSearch> | undefined;
} = {current: undefined};

function SearchController() {
  const search = useChatSearch();
  React.useEffect(() => {
    latestSearchRef.current = search;
  });
  return null;
}

function renderReasoning() {
  latestSearchRef.current = undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = createTestStore();

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatSearchProvider>
          <BlockRegistrar />
          <DefaultChatReasoning
            text="thinking about design carefully"
            isRunning={false}
            searchBlockId={REASONING_BLOCK_ID}
          />
          <OtherBlockReporter />
          <SearchController />
        </ChatSearchProvider>
      </RoomStateProvider>,
    );
  });

  return {container, root, store};
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

function setQuery(query: string) {
  act(() => {
    if (!latestSearchRef.current) {
      throw new Error('Search context was not captured.');
    }
    latestSearchRef.current.setQuery(query);
  });
}

describe('DefaultChatReasoning search auto-open', () => {
  it('starts closed with no search query', () => {
    const {container, root} = renderReasoning();

    const details = container.querySelector('details');
    expect(details).toBeInstanceOf(HTMLDetailsElement);
    expect((details as HTMLDetailsElement).open).toBe(false);

    cleanup(container, root);
  });

  it('opens when this block holds the active match', () => {
    const {container, root} = renderReasoning();

    setQuery('design');

    const details = container.querySelector('details') as HTMLDetailsElement;
    // "thinking about design carefully" is the first block registered, so
    // its match becomes the active one immediately.
    expect(latestSearchRef.current?.matches[0]?.blockId).toBe(
      REASONING_BLOCK_ID,
    );
    expect(details.open).toBe(true);

    cleanup(container, root);
  });

  it('stays open once opened even after the active match moves elsewhere', () => {
    const {container, root} = renderReasoning();

    setQuery('design');
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);

    act(() => {
      latestSearchRef.current?.goToNextMatch();
    });
    expect(latestSearchRef.current?.activeMatchId).toBe(
      latestSearchRef.current?.matches[1]?.id,
    );
    expect(latestSearchRef.current?.matches[1]?.blockId).toBe(OTHER_BLOCK_ID);

    // Active match moved off this block, but the details element must not
    // re-close itself.
    expect(details.open).toBe(true);

    cleanup(container, root);
  });
});
