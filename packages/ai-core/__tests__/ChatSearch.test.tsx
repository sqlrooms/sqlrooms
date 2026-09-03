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
  HighlightedChatSearchText,
  useChatSearch,
  useHasActiveChatSearchMatch,
  useRegisterChatSearchBlocks,
  useReportRenderedChatSearchBlock,
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

function RenderedBlockReporter({blockId}: {blockId: string}) {
  useReportRenderedChatSearchBlock(blockId);
  return null;
}

// Registers blocks like ChatTurnView does, and also mounts a reporter for
// each rendered id so tests can control which blocks actually "rendered"
// versus merely indexed.
function BlockRegistrar({
  groupId = 'group',
  blocks,
  renderedIds,
}: {
  groupId?: string;
  blocks: ChatSearchBlock[];
  renderedIds?: string[];
}) {
  useRegisterChatSearchBlocks(groupId, blocks);
  const idsToRender = renderedIds ?? blocks.map((block) => block.id);
  return (
    <>
      {idsToRender.map((id) => (
        <RenderedBlockReporter key={id} blockId={id} />
      ))}
    </>
  );
}

// Mirrors ChatTurnView: search blocks are only built while a query is active,
// so the registered blocks transition from [] to real content after the user types.
function QueryAwareBlockRegistrar({
  groupId = 'group',
  blocks,
}: {
  groupId?: string;
  blocks: ChatSearchBlock[];
}) {
  const {query} = useChatSearch();
  const hasQuery = query.trim().length > 0;
  const activeBlocks = React.useMemo(
    () => (hasQuery ? blocks : []),
    [hasQuery, blocks],
  );
  useRegisterChatSearchBlocks(groupId, activeBlocks);
  return (
    <>
      {activeBlocks.map((block) => (
        <RenderedBlockReporter key={block.id} blockId={block.id} />
      ))}
    </>
  );
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
  renderedIds?: string[];
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
          <BlockRegistrar
            blocks={options?.blocks ?? blocks}
            renderedIds={options?.renderedIds}
          />
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
  it('reports matches when blocks are registered after the query is entered', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <QueryAwareBlockRegistrar blocks={blocks} />
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    setDesignQuery();
    expect(container.textContent).toContain('1/2');

    cleanup(container, root);
  });

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

  it('does not loop when turns re-register equivalent empty blocks', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();
    let consumerRenderCount = 0;

    function SearchConsumer() {
      useChatSearch();
      React.useEffect(() => {
        consumerRenderCount += 1;
      });
      return null;
    }

    function FreshEmptyRegistrar({nonce}: {nonce: number}) {
      // Fresh [] each render — mirrors ChatTurnView when searchBlocks memo
      // invalidates and returns a new empty array on every streamed token.
      void nonce;
      useRegisterChatSearchBlocks('turn-1', []);
      useRegisterChatSearchBlocks('turn-2', []);
      return <SearchConsumer />;
    }

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <FreshEmptyRegistrar nonce={0} />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    const afterMount = consumerRenderCount;

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <FreshEmptyRegistrar nonce={1} />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <FreshEmptyRegistrar nonce={2} />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    // Without equality bailout, each fresh [] registration setStates the
    // provider, re-renders the registrar with another fresh [], and exceeds
    // React's max update depth. Keep consumer renders bounded.
    expect(consumerRenderCount).toBeLessThan(afterMount + 10);
    expect(consumerRenderCount).toBeLessThan(50);

    cleanup(container, root);
  });
});

describe('Chat.Search rendered-set intersection', () => {
  it('excludes a registered block that never renders from the match count', () => {
    const {container, root} = renderSearchUi({renderedIds: []});

    setDesignQuery();
    expect(container.textContent).toContain('0/0');

    cleanup(container, root);
  });

  it('includes a registered block once it renders', () => {
    const {container, root} = renderSearchUi({
      renderedIds: ['session-1:result-1:prompt'],
    });

    setDesignQuery();
    expect(container.textContent).toContain('1/1');
    expect(
      latestSearchRef.current?.matches.map((match) => match.blockId),
    ).toEqual(['session-1:result-1:prompt']);

    cleanup(container, root);
  });

  it('renders and reports a block through HighlightedChatSearchText', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar blocks={blocks} renderedIds={[]} />
            <HighlightedChatSearchText
              blockId="session-1:result-1:prompt"
              text="Show me design trends"
            />
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    setDesignQuery();
    expect(container.textContent).toContain('1/1');

    cleanup(container, root);
  });

  it('contributes no match when the painted text does not contain the query', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar blocks={blocks} renderedIds={[]} />
            <HighlightedChatSearchText
              blockId="session-1:result-1:prompt"
              text="Show"
            />
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    setDesignQuery();
    expect(container.textContent).toContain('0/0');
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('Show');

    cleanup(container, root);
  });

  it('matches the reported text rather than the registered text', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar blocks={blocks} renderedIds={[]} />
            <HighlightedChatSearchText
              blockId="session-1:result-1:prompt"
              text="Show me travel trends"
            />
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    act(() => {
      if (!latestSearchRef.current) {
        throw new Error('Search context was not captured.');
      }
      latestSearchRef.current.setQuery('travel');
    });
    expect(container.textContent).toContain('1/1');
    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('travel');

    act(() => {
      latestSearchRef.current?.setQuery('design');
    });
    expect(container.textContent).toContain('0/0');

    cleanup(container, root);
  });

  it('keeps a block indexed while a second reporter still has it mounted', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    function Scene({bothReporters}: {bothReporters: boolean}) {
      return (
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar blocks={blocks} renderedIds={[]} />
            <RenderedBlockReporter blockId="session-1:result-1:prompt" />
            {bothReporters ? (
              <RenderedBlockReporter blockId="session-1:result-1:prompt" />
            ) : null}
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>
      );
    }

    act(() => {
      root.render(<Scene bothReporters />);
    });
    setDesignQuery();
    expect(container.textContent).toContain('1/1');

    // Dropping one of two reporters must not evict a block the other still shows.
    act(() => {
      root.render(<Scene bothReporters={false} />);
    });
    expect(container.textContent).toContain('1/1');

    cleanup(container, root);
  });

  it('drops matches when a rendered block unmounts', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    function Scene({renderBoth}: {renderBoth: boolean}) {
      return (
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar
              blocks={blocks}
              renderedIds={
                renderBoth
                  ? ['session-1:result-1:prompt', 'session-1:result-1:text:0']
                  : ['session-1:result-1:prompt']
              }
            />
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>
      );
    }

    act(() => {
      root.render(<Scene renderBoth />);
    });
    setDesignQuery();
    expect(container.textContent).toContain('1/2');

    act(() => {
      root.render(<Scene renderBoth={false} />);
    });
    expect(container.textContent).toContain('1/1');
    expect(
      latestSearchRef.current?.matches.map((match) => match.blockId),
    ).toEqual(['session-1:result-1:prompt']);

    cleanup(container, root);
  });

  it('preserves the relative order of remaining blocks when an unrendered middle block is filtered out', () => {
    const orderedBlocks: ChatSearchBlock[] = [
      {id: 'session-1:result-1:a', resultId: 'result-1', text: 'design alpha'},
      {id: 'session-1:result-1:b', resultId: 'result-1', text: 'design beta'},
      {
        id: 'session-1:result-1:c',
        resultId: 'result-1',
        text: 'design gamma',
      },
    ];
    const {container, root} = renderSearchUi({
      blocks: orderedBlocks,
      renderedIds: ['session-1:result-1:a', 'session-1:result-1:c'],
    });

    setDesignQuery();
    expect(
      latestSearchRef.current?.matches.map((match) => match.blockId),
    ).toEqual(['session-1:result-1:a', 'session-1:result-1:c']);
    expect(container.textContent).toContain('1/2');

    act(() => {
      container
        .querySelector('button[aria-label="Next chat search match"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    expect(latestSearchRef.current?.activeMatchId).toBe(
      latestSearchRef.current?.matches[1]?.id,
    );
    expect(container.textContent).toContain('2/2');

    cleanup(container, root);
  });

  it('does not loop when a rendered block re-reports an unchanged id', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();
    let consumerRenderCount = 0;

    function SearchConsumer() {
      useChatSearch();
      React.useEffect(() => {
        consumerRenderCount += 1;
      });
      return null;
    }

    function RerenderingRenderedBlock({nonce}: {nonce: number}) {
      // Fresh render each time, same blockId — mirrors a block re-rendering
      // on every streamed token while it stays mounted.
      void nonce;
      useReportRenderedChatSearchBlock('session-1:result-1:prompt');
      return <SearchConsumer />;
    }

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <RerenderingRenderedBlock nonce={0} />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    const afterMount = consumerRenderCount;

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <RerenderingRenderedBlock nonce={1} />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <RerenderingRenderedBlock nonce={2} />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    expect(consumerRenderCount).toBeLessThan(afterMount + 10);
    expect(consumerRenderCount).toBeLessThan(50);

    cleanup(container, root);
  });
});

describe('useHasActiveChatSearchMatch', () => {
  function ActiveMatchProbe({
    blockId,
    label,
  }: {
    blockId?: string;
    label: string;
  }) {
    const hasActiveMatch = useHasActiveChatSearchMatch(blockId);
    return <div data-testid={label}>{String(hasActiveMatch)}</div>;
  }

  it('returns false with no provider', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ActiveMatchProbe blockId="session-1:result-1:prompt" label="probe" />,
      );
    });

    expect(container.querySelector('[data-testid="probe"]')?.textContent).toBe(
      'false',
    );

    cleanup(container, root);
  });

  it('returns false when the block has matches but none is the active match, and true when navigation lands on it', () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar blocks={blocks} />
            <ActiveMatchProbe
              blockId="session-1:result-1:prompt"
              label="prompt"
            />
            <ActiveMatchProbe
              blockId="session-1:result-1:text:0"
              label="text"
            />
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    setDesignQuery();

    // The prompt match ("Show me design trends") comes first, so it starts
    // active. The text block has a match of its own, but it is not active yet.
    expect(container.querySelector('[data-testid="prompt"]')?.textContent).toBe(
      'true',
    );
    expect(container.querySelector('[data-testid="text"]')?.textContent).toBe(
      'false',
    );

    act(() => {
      container
        .querySelector('button[aria-label="Next chat search match"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    // Advancing to the next match flips which block reports the active match.
    expect(container.querySelector('[data-testid="prompt"]')?.textContent).toBe(
      'false',
    );
    expect(container.querySelector('[data-testid="text"]')?.textContent).toBe(
      'true',
    );

    cleanup(container, root);
  });
});
