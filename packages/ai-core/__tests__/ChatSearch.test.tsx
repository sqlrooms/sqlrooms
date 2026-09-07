/**
 * @jest-environment jsdom
 */
import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createStore} from 'zustand';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import {TextDecoder} from 'node:util';
import type {ChatSearchBlock} from '../src/components/ChatSearch';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  TransformStream,
  TextDecoder,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {
  ChatSearch,
  ChatSearchProvider,
  createChatSearchRehypePlugin,
  findChatSearchMatches,
  HighlightedChatSearchText,
  markdownToPlainText,
  useChatSearch,
  useActiveChatSearchMatchKey,
  useRegisterChatSearchBlocks,
  useReportRenderedChatSearchBlock,
} = await import('../src/components/ChatSearch');
const {ChatAttachmentPreview} =
  await import('../src/components/ChatAttachmentPreview');
const {getChatAttachmentSearchText} =
  await import('../src/components/ChatTurnView');

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

function RenderedBlockReporter({
  blockId,
  text,
}: {
  blockId: string;
  text?: string;
}) {
  useReportRenderedChatSearchBlock(blockId, text);
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
  reportRendered = true,
}: {
  groupId?: string;
  blocks: ChatSearchBlock[];
  reportRendered?: boolean;
}) {
  const {query} = useChatSearch();
  const hasQuery = query.trim().length > 0;
  const activeBlocks = React.useMemo(
    () => (hasQuery ? blocks : []),
    [hasQuery, blocks],
  );
  useRegisterChatSearchBlocks(groupId, activeBlocks);
  if (!reportRendered) return null;
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

async function waitForCondition(
  condition: () => boolean,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  throw new Error(`Timed out waiting for ${description}`);
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

  it('normalizes Markdown attachments to their rendered search offsets', () => {
    const text = getChatAttachmentSearchText({
      type: 'file',
      filename: 'report.md',
      mediaType: 'text/markdown',
      url: 'data:text/markdown;base64,IyBSZXBvcnQKClJldmVudWUgZ3Jldy4=',
    });
    const [match] = findChatSearchMatches(
      [{id: 'attachment', resultId: 'result', text: text ?? ''}],
      'Revenue',
    );

    expect(text).toBe('Report\nRevenue grew.');
    expect(match?.start).toBe(7);
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

  it('keeps offsets aligned when custom-rendered element subtrees are excluded', () => {
    const markdown = '`hidden design` visible design';
    const text = markdownToPlainText(markdown, ['code']);
    expect(text).toBe('\u0000 visible design');

    const tree: any = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [
            {
              type: 'element',
              tagName: 'code',
              children: [{type: 'text', value: 'hidden design'}],
            },
            {type: 'text', value: ' visible design'},
          ],
        },
      ],
    };
    const matches = findChatSearchMatches(
      [{id: 'block', resultId: 'result', text}],
      'design',
    );

    createChatSearchRehypePlugin({
      blockId: 'block',
      matches,
      excludedTagNames: ['code'],
    })()(tree);

    expect(JSON.stringify(tree.children[0].children[0])).not.toContain(
      '"tagName":"mark"',
    );
    const marks = tree.children[0].children.filter(
      (child: any) => child.tagName === 'mark',
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].children[0].value).toBe('design');
  });
});

describe('Chat.Search', () => {
  it('opens and highlights an active text-attachment match', async () => {
    latestSearchRef.current = undefined;
    const attachmentBlock: ChatSearchBlock = {
      id: 'session-1:result-1:attachment:0',
      resultId: 'result-1',
      text: 'Revenue grew this quarter.',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <QueryAwareBlockRegistrar
              blocks={[attachmentBlock]}
              reportRendered={false}
            />
            <SearchController />
            <ChatAttachmentPreview
              attachment={{
                type: 'file',
                filename: 'report.txt',
                mediaType: 'text/plain',
                url: 'data:text/plain;base64,UmV2ZW51ZSBncmV3IHRoaXMgcXVhcnRlci4=',
              }}
              searchBlockId={attachmentBlock.id}
            />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    await act(async () => {
      latestSearchRef.current?.setQuery('Revenue');
    });

    const activeMatchId = latestSearchRef.current?.activeMatchId;
    expect(activeMatchId).toBeDefined();
    for (let attempts = 0; attempts < 20; attempts += 1) {
      if (document.getElementById(activeMatchId!)) break;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(document.body.textContent).toContain('Attached text file preview');
    expect(document.getElementById(activeMatchId!)).not.toBeNull();

    cleanup(container, root);
  });

  it('reopens a closed attachment when the query changes at the same offset', async () => {
    latestSearchRef.current = undefined;
    const attachmentBlock: ChatSearchBlock = {
      id: 'session-1:result-1:attachment:0',
      resultId: 'result-1',
      text: 'foobar content',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <QueryAwareBlockRegistrar
              blocks={[attachmentBlock]}
              reportRendered={false}
            />
            <SearchController />
            <ChatAttachmentPreview
              attachment={{
                type: 'file',
                filename: 'report.txt',
                mediaType: 'text/plain',
                url: 'data:text/plain;base64,Zm9vYmFyIGNvbnRlbnQ=',
              }}
              searchBlockId={attachmentBlock.id}
            />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    await act(async () => {
      latestSearchRef.current?.setQuery('foo');
    });

    const firstMatchId = latestSearchRef.current?.activeMatchId;
    for (let attempts = 0; attempts < 20; attempts += 1) {
      if (document.getElementById(firstMatchId!)) break;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    const closeButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.trim() === 'Close');
    expect(closeButton).toBeDefined();
    act(() => closeButton?.click());
    expect(document.body.textContent).not.toContain(
      'Attached text file preview',
    );

    await act(async () => {
      latestSearchRef.current?.setQuery('foobar');
    });
    expect(latestSearchRef.current?.activeMatchId).toBe(firstMatchId);

    for (let attempts = 0; attempts < 20; attempts += 1) {
      if (document.body.textContent?.includes('Attached text file preview')) {
        break;
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(document.body.textContent).toContain('Attached text file preview');
    expect(document.getElementById(firstMatchId!)).not.toBeNull();

    cleanup(container, root);
  });

  it('reopens a manually closed attachment on repeated navigation', async () => {
    latestSearchRef.current = undefined;
    const attachmentBlock: ChatSearchBlock = {
      id: 'session-1:result-1:attachment:0',
      resultId: 'result-1',
      text: 'single needle',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <QueryAwareBlockRegistrar
              blocks={[attachmentBlock]}
              reportRendered={false}
            />
            <SearchController />
            <ChatAttachmentPreview
              attachment={{
                type: 'file',
                filename: 'report.txt',
                mediaType: 'text/plain',
                url: 'data:text/plain;base64,c2luZ2xlIG5lZWRsZQ==',
              }}
              searchBlockId={attachmentBlock.id}
            />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    await act(async () => {
      latestSearchRef.current?.setQuery('needle');
    });
    await waitForCondition(
      () => document.body.querySelector('[role="dialog"]') !== null,
      'attachment preview to open',
    );

    const closeButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.trim() === 'Close');
    expect(closeButton).toBeDefined();
    act(() => closeButton?.click());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      latestSearchRef.current?.goToNextMatch();
    });
    await waitForCondition(
      () => document.body.querySelector('[role="dialog"]') !== null,
      'attachment preview to reopen',
    );
    expect(latestSearchRef.current?.matches).toHaveLength(1);
    expect(
      document.body.querySelector('[role="dialog"]')?.textContent,
    ).toContain('report.txt');

    cleanup(container, root);
  });

  it('closes the previous attachment preview during search navigation', async () => {
    latestSearchRef.current = undefined;
    const attachmentBlocks: ChatSearchBlock[] = [
      {
        id: 'session-1:result-1:attachment:0',
        resultId: 'result-1',
        text: 'needle in first',
      },
      {
        id: 'session-1:result-1:attachment:1',
        resultId: 'result-1',
        text: 'needle in second',
      },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();

    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <QueryAwareBlockRegistrar
              blocks={attachmentBlocks}
              reportRendered={false}
            />
            <SearchController />
            <ChatAttachmentPreview
              attachment={{
                type: 'file',
                filename: 'first.txt',
                mediaType: 'text/plain',
                url: 'data:text/plain;base64,bmVlZGxlIGluIGZpcnN0',
              }}
              searchBlockId={attachmentBlocks[0]!.id}
            />
            <ChatAttachmentPreview
              attachment={{
                type: 'file',
                filename: 'second.txt',
                mediaType: 'text/plain',
                url: 'data:text/plain;base64,bmVlZGxlIGluIHNlY29uZA==',
              }}
              searchBlockId={attachmentBlocks[1]!.id}
            />
          </ChatSearchProvider>
        </RoomStateProvider>,
      );
    });

    await act(async () => {
      latestSearchRef.current?.setQuery('needle');
    });
    await waitForCondition(
      () => document.body.querySelectorAll('[role="dialog"]').length === 1,
      'first attachment preview to open',
    );
    expect(
      document.body.querySelector('[role="dialog"]')?.textContent,
    ).toContain('first.txt');

    await act(async () => {
      latestSearchRef.current?.goToNextMatch();
    });
    await waitForCondition(() => {
      const dialogs = document.body.querySelectorAll('[role="dialog"]');
      return (
        dialogs.length === 1 &&
        dialogs[0]?.textContent?.includes('second.txt') === true
      );
    }, 'second attachment preview to replace the first');

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(
      document.body.querySelector('[role="dialog"]')?.textContent,
    ).not.toContain('first.txt');

    cleanup(container, root);
  });

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

  it("falls back to the remaining reporter's text when the reporter that reported last unmounts", () => {
    latestSearchRef.current = undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createTestStore();
    const blockId = 'session-1:result-1:multi';
    const registeredBlocks: ChatSearchBlock[] = [
      {id: blockId, resultId: 'result-1', text: 'placeholder'},
    ];

    // The first reporter paints its own text, so a match against it also
    // shows up as a real <mark>. The second reporter mounts after the first
    // and only reports text, so it becomes the more recently reported one.
    function Scene({secondMounted}: {secondMounted: boolean}) {
      return (
        <RoomStateProvider roomStore={store}>
          <ChatSearchProvider>
            <BlockRegistrar blocks={registeredBlocks} renderedIds={[]} />
            <HighlightedChatSearchText blockId={blockId} text="alpha content" />
            {secondMounted ? (
              <RenderedBlockReporter blockId={blockId} text="beta content" />
            ) : null}
            <ChatSearch />
            <SearchController />
          </ChatSearchProvider>
        </RoomStateProvider>
      );
    }

    act(() => {
      root.render(<Scene secondMounted />);
    });

    act(() => {
      latestSearchRef.current?.setQuery('beta');
    });
    // The most recently reported live reporter's text is matched against.
    expect(container.textContent).toContain('1/1');

    act(() => {
      root.render(<Scene secondMounted={false} />);
    });
    // The reporter that reported last unmounted, so its text must no longer
    // be matched against.
    expect(container.textContent).toContain('0/0');

    act(() => {
      latestSearchRef.current?.setQuery('alpha');
    });
    // Matching falls back to the remaining reporter's text, not the departed
    // one's.
    expect(container.textContent).toContain('1/1');
    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('alpha');

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

describe('useActiveChatSearchMatchKey', () => {
  function ActiveMatchProbe({
    blockId,
    label,
  }: {
    blockId?: string;
    label: string;
  }) {
    const activeMatchKey = useActiveChatSearchMatchKey(blockId);
    return <div data-testid={label}>{activeMatchKey ?? ''}</div>;
  }

  it('returns undefined with no provider', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ActiveMatchProbe blockId="session-1:result-1:prompt" label="probe" />,
      );
    });

    expect(container.querySelector('[data-testid="probe"]')?.textContent).toBe(
      '',
    );

    cleanup(container, root);
  });

  it('returns undefined when the block has matches but none is active, and a key when navigation lands on it', () => {
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
    const promptKey = container.querySelector(
      '[data-testid="prompt"]',
    )?.textContent;
    expect(promptKey).toMatch(/^\d+:session-1:result-1:prompt:/);
    expect(container.querySelector('[data-testid="text"]')?.textContent).toBe(
      '',
    );

    act(() => {
      container
        .querySelector('button[aria-label="Next chat search match"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    // Advancing to the next match flips which block reports the active match,
    // and the reported selection key changes with it.
    expect(container.querySelector('[data-testid="prompt"]')?.textContent).toBe(
      '',
    );
    const textKey = container.querySelector(
      '[data-testid="text"]',
    )?.textContent;
    expect(textKey).toMatch(/^\d+:session-1:result-1:text:0:/);
    expect(textKey).not.toBe(promptKey);

    cleanup(container, root);
  });
});
