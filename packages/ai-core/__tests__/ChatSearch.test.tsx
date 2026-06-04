/**
 * @jest-environment jsdom
 */
import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createStore} from 'zustand';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import type {ChatSearchBlock} from '../src/components/ChatSearch';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {
  ChatSearch,
  ChatSearchProvider,
  createChatSearchRehypePlugin,
  findChatSearchMatches,
  useChatSearch,
  useRegisterChatSearchBlocks,
} = await import('../src/components/ChatSearch');

const blocks: ChatSearchBlock[] = [
  {
    id: 'session-1:result-1:prompt',
    resultId: 'result-1',
    text: 'Show me design trends',
  },
  {
    id: 'session-1:result-1:text:0',
    resultId: 'result-1',
    text: 'The strongest Design signal appears in three columns.',
  },
  {
    id: 'session-1:result-1:tool:1',
    resultId: 'result-1',
    text: 'query output-available',
  },
];

function createTestStore(sessionId = 'session-1') {
  return createStore<AiSliceState>(() => ({
    ai: {
      config: {
        currentSessionId: sessionId,
      },
    },
  })) as any;
}

function BlockRegistrar({
  groupId = 'group',
  blocks,
}: {
  groupId?: string;
  blocks: ChatSearchBlock[];
}) {
  useRegisterChatSearchBlocks(groupId, blocks);
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

function renderSearchUi(options?: {
  blocks?: ChatSearchBlock[];
  sessionId?: string;
}) {
  latestSearchRef.current = undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = createTestStore(options?.sessionId);

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatSearchProvider>
          <BlockRegistrar blocks={options?.blocks ?? blocks} />
          <ChatSearch />
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

function setDesignQuery() {
  act(() => {
    if (!latestSearchRef.current) {
      throw new Error('Search context was not captured.');
    }
    latestSearchRef.current?.setQuery('design');
  });
}

describe('chat search helpers', () => {
  it('finds prompt and assistant matches case-insensitively', () => {
    const matches = findChatSearchMatches(blocks, 'design');

    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.blockId)).toEqual([
      'session-1:result-1:prompt',
      'session-1:result-1:text:0',
    ]);
  });

  it('handles multiple matches in one block', () => {
    const matches = findChatSearchMatches(
      [
        {
          id: 'session-1:result-2:text:0',
          resultId: 'result-2',
          text: 'design, Design, redesign',
        },
      ],
      'design',
    );

    expect(matches.map((match) => match.start)).toEqual([0, 8, 18]);
  });

  it('ignores empty queries', () => {
    expect(findChatSearchMatches(blocks, '   ')).toEqual([]);
  });

  it('uses lightweight tool labels instead of large payload text', () => {
    const matches = findChatSearchMatches(blocks, 'payload');

    expect(matches).toEqual([]);
  });

  it('marks text without changing link and code element wrappers', () => {
    const tree: any = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [
            {type: 'text', value: 'See '},
            {
              type: 'element',
              tagName: 'a',
              properties: {href: '#'},
              children: [{type: 'text', value: 'design docs'}],
            },
            {type: 'text', value: ' and '},
            {
              type: 'element',
              tagName: 'code',
              children: [{type: 'text', value: 'design_token'}],
            },
          ],
        },
      ],
    };
    const matches = findChatSearchMatches(
      [
        {
          id: 'block',
          resultId: 'result',
          text: 'See design docs and design_token',
        },
      ],
      'design',
    );

    createChatSearchRehypePlugin({
      blockId: 'block',
      matches,
      activeMatchId: matches[0]?.id,
    })()(tree);

    const paragraph = tree.children[0];
    expect(paragraph.children[1].tagName).toBe('a');
    expect(paragraph.children[3].tagName).toBe('code');
    expect(JSON.stringify(tree)).toContain('"tagName":"mark"');
  });
});

describe('Chat.Search', () => {
  it('renders match counts and wraps next/previous navigation', () => {
    const {container, root} = renderSearchUi();

    const input = container.querySelector('input[aria-label="Search chat"]');
    expect(input).toBeInstanceOf(HTMLInputElement);

    setDesignQuery();
    expect(container.textContent).toContain('1/2');

    act(() => {
      container
        .querySelector('button[aria-label="Next chat search match"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    expect(container.textContent).toContain('2/2');

    act(() => {
      container
        .querySelector('button[aria-label="Next chat search match"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    expect(container.textContent).toContain('1/2');

    act(() => {
      container
        .querySelector('button[aria-label="Previous chat search match"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    expect(container.textContent).toContain('2/2');

    cleanup(container, root);
  });
});
