/**
 * @jest-environment jsdom
 */
import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createStore} from 'zustand';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import type {Components} from 'react-markdown';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {
  ChatSearch,
  ChatSearchProvider,
  markdownToPlainText,
  useChatSearch,
  useRegisterChatSearchBlocks,
} = await import('../src/components/ChatSearch');
const {getChatSearchExcludedMarkdownTags, MessageContent} =
  await import('../src/components/MessageContent');

const BLOCK_ID = 'session-1:result-1:text:0';
const HIDE_CODE_COMPONENTS: Partial<Components> = {code: () => null};
const REPLACE_CODE_COMPONENTS: Partial<Components> = {
  code: () => <>replacement</>,
};
const HIDE_MARK_COMPONENTS: Partial<Components> = {mark: () => null};

function createTestStore() {
  return createStore<AiSliceState>(
    () =>
      ({
        ai: {config: {currentSessionId: 'session-1'}},
      }) as unknown as AiSliceState,
  ) as any;
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

function SearchableMessage({
  content,
  customMarkdownComponents,
}: {
  content: string;
  customMarkdownComponents?: Partial<Components>;
}) {
  const excludedTags = React.useMemo(
    () => getChatSearchExcludedMarkdownTags(customMarkdownComponents),
    [customMarkdownComponents],
  );
  const blocks = React.useMemo(() => {
    const text = excludedTags ? markdownToPlainText(content, excludedTags) : '';
    return text.trim() ? [{id: BLOCK_ID, resultId: 'result-1', text}] : [];
  }, [content, excludedTags]);
  useRegisterChatSearchBlocks('turn-1', blocks);

  return (
    <MessageContent
      content={content}
      isAnswer
      searchBlockId={BLOCK_ID}
      customMarkdownComponents={customMarkdownComponents}
    />
  );
}

function renderMessage(
  content: string,
  customMarkdownComponents?: Partial<Components>,
) {
  latestSearchRef.current = undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = createTestStore();

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatSearchProvider>
          <SearchableMessage
            content={content}
            customMarkdownComponents={customMarkdownComponents}
          />
          <ChatSearch />
          <SearchController />
        </ChatSearchProvider>
      </RoomStateProvider>,
    );
  });

  return {container, root};
}

function setQuery(query: string) {
  act(() => {
    if (!latestSearchRef.current) {
      throw new Error('Search context was not captured.');
    }
    latestSearchRef.current.setQuery(query);
  });
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

describe('MessageContent chat search', () => {
  it('highlights text rendered by the default Markdown components', () => {
    const {container, root} = renderMessage('visible design');

    setQuery('design');

    expect(latestSearchRef.current?.matches).toHaveLength(1);
    expect(container.querySelector('mark')?.textContent).toBe('design');
    expect(container.textContent).toContain('1/1');

    cleanup(container, root);
  });

  it('ignores undefined custom component entries', () => {
    const codeResult = renderMessage('`visible design`', {code: undefined});

    setQuery('design');
    expect(latestSearchRef.current?.matches).toHaveLength(1);
    expect(codeResult.container.querySelector('mark')?.textContent).toBe(
      'design',
    );
    cleanup(codeResult.container, codeResult.root);

    const markResult = renderMessage('visible design', {mark: undefined});

    setQuery('design');
    expect(latestSearchRef.current?.matches).toHaveLength(1);
    expect(markResult.container.querySelector('mark')?.textContent).toBe(
      'design',
    );
    cleanup(markResult.container, markResult.root);
  });

  it('excludes custom-rendered subtrees while preserving other searchable text', () => {
    const {container, root} = renderMessage(
      '`hidden design` visible design',
      HIDE_CODE_COMPONENTS,
    );

    setQuery('design');
    expect(latestSearchRef.current?.matches).toHaveLength(1);
    expect(container.querySelector('mark')?.textContent).toBe('design');
    expect(container.textContent).not.toContain('hidden design');
    expect(container.textContent).toContain('1/1');

    setQuery('hidden');
    expect(latestSearchRef.current?.matches).toHaveLength(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('0/0');

    cleanup(container, root);
  });

  it('disables automatic search when the mark renderer is overridden', () => {
    const {container, root} = renderMessage(
      'visible design',
      HIDE_MARK_COMPONENTS,
    );

    setQuery('design');

    expect(latestSearchRef.current?.matches).toHaveLength(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('0/0');

    cleanup(container, root);
  });

  it('does not match across a custom-renderer boundary', () => {
    const {container, root} = renderMessage(
      'left`hidden`right',
      REPLACE_CODE_COMPONENTS,
    );

    expect(container.textContent).toContain('leftreplacementright');
    setQuery('tr');

    expect(latestSearchRef.current?.matches).toHaveLength(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('0/0');

    cleanup(container, root);
  });
});
