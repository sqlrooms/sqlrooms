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

const TWO_MATCH_TEXT = 'design first then design again';

function TwoMatchBlockRegistrar() {
  useRegisterChatSearchBlocks('turn-1', [
    {
      id: REASONING_BLOCK_ID,
      resultId: 'result-1',
      text: TWO_MATCH_TEXT,
    },
  ]);
  return null;
}

function renderReasoningWithTwoMatchesInOneBlock() {
  latestSearchRef.current = undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = createTestStore();

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatSearchProvider>
          <TwoMatchBlockRegistrar />
          <DefaultChatReasoning
            text={TWO_MATCH_TEXT}
            isRunning={false}
            searchBlockId={REASONING_BLOCK_ID}
          />
          <SearchController />
        </ChatSearchProvider>
      </RoomStateProvider>,
    );
  });

  return {container, root, store};
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

  it('reopens for the second match in the same block after being closed manually', () => {
    const {container, root} = renderReasoningWithTwoMatchesInOneBlock();

    setQuery('design');
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(latestSearchRef.current?.matches).toHaveLength(2);
    expect(details.open).toBe(true);

    // Simulate the user collapsing the disclosure by hand.
    act(() => {
      details.open = false;
    });
    expect(details.open).toBe(false);

    act(() => {
      latestSearchRef.current?.goToNextMatch();
    });
    expect(latestSearchRef.current?.matches[1]?.blockId).toBe(
      REASONING_BLOCK_ID,
    );
    expect(latestSearchRef.current?.activeMatchId).toBe(
      latestSearchRef.current?.matches[1]?.id,
    );

    // Both matches belong to this same block, so a boolean "has active
    // match" signal never changes and would leave the disclosure closed.
    // Navigating to the second match must still reopen it.
    expect(details.open).toBe(true);

    cleanup(container, root);
  });

  it.each([
    ['next', 'goToNextMatch'],
    ['previous', 'goToPreviousMatch'],
  ] as const)(
    'reopens when %s navigation selects the only match again',
    (_direction, navigate) => {
      const {container, root} = renderReasoningWithTwoMatchesInOneBlock();

      setQuery('first');
      const details = container.querySelector('details') as HTMLDetailsElement;
      expect(latestSearchRef.current?.matches).toHaveLength(1);
      expect(details.open).toBe(true);

      act(() => {
        details.open = false;
        latestSearchRef.current?.[navigate]();
      });

      expect(latestSearchRef.current?.activeMatchNumber).toBe(1);
      expect(details.open).toBe(true);

      cleanup(container, root);
    },
  );

  it('reopens when a new query reuses the active match id', () => {
    const {container, root} = renderReasoningWithTwoMatchesInOneBlock();

    setQuery('design first');
    const details = container.querySelector('details') as HTMLDetailsElement;
    const firstMatchId = latestSearchRef.current?.activeMatchId;
    expect(details.open).toBe(true);

    act(() => {
      details.open = false;
    });
    setQuery('design');

    expect(latestSearchRef.current?.activeMatchId).toBe(firstMatchId);
    expect(details.open).toBe(true);

    cleanup(container, root);
  });
});
