import {Button, cn, Input} from '@sqlrooms/ui';
import {ChevronDownIcon, ChevronUpIcon, SearchIcon} from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {PropsWithChildren} from 'react';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import {useStoreWithAi} from '../AiSlice';

const markdownHastProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, {allowDangerousHtml: true})
  .use(rehypeRaw);

function collectHastText(node: any): string {
  if (!node) return '';
  if (node.type === 'text' && typeof node.value === 'string') {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    let out = '';
    for (const child of node.children) {
      out += collectHastText(child);
    }
    return out;
  }
  return '';
}

export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';
  try {
    const mdast = markdownHastProcessor.parse(markdown);
    const hast = markdownHastProcessor.runSync(mdast);
    return collectHastText(hast);
  } catch {
    return markdown;
  }
}

export type ChatSearchBlock = {
  id: string;
  resultId: string;
  text: string;
};

export type ChatSearchMatch = {
  id: string;
  blockId: string;
  resultId: string;
  start: number;
  end: number;
};

type ChatSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
  matches: ChatSearchMatch[];
  activeMatchId?: string;
  activeMatchNumber: number;
  registerBlocks: (groupId: string, blocks: ChatSearchBlock[]) => void;
  unregisterBlocks: (groupId: string) => void;
  getMatchesForBlock: (blockId: string) => ChatSearchMatch[];
  goToNextMatch: () => void;
  goToPreviousMatch: () => void;
  clearSearch: () => void;
};

const ChatSearchContext = createContext<ChatSearchContextValue | null>(null);

export function normalizeChatSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export function findChatSearchMatches(
  blocks: ChatSearchBlock[],
  query: string,
): ChatSearchMatch[] {
  const normalizedQuery = normalizeChatSearchQuery(query);
  if (!normalizedQuery) return [];

  const matches: ChatSearchMatch[] = [];
  for (const block of blocks) {
    if (!block.text) continue;

    const normalizedText = block.text.toLocaleLowerCase();
    let start = normalizedText.indexOf(normalizedQuery);

    while (start !== -1) {
      const end = start + normalizedQuery.length;
      matches.push({
        id: `${block.id}:${start}`,
        blockId: block.id,
        resultId: block.resultId,
        start,
        end,
      });
      start = normalizedText.indexOf(normalizedQuery, end);
    }
  }
  return matches;
}

export const ChatSearchProvider: React.FC<PropsWithChildren> = ({children}) => {
  const currentSessionId = useStoreWithAi(
    (s) => s.ai.config.currentSessionId ?? '',
  );
  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [blockGroups, setBlockGroups] = useState<
    Record<string, ChatSearchBlock[]>
  >({});

  // reset active index during render when session or query changes
  // (avoids cascading effect/setState round-trip)
  const resetKey = `${currentSessionId}:${query}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setActiveMatchIndex(0);
  }

  const blocks = useMemo(() => {
    const allBlocks = Object.values(blockGroups).flat();
    if (!currentSessionId) return allBlocks;
    return allBlocks.filter((block) =>
      block.id.startsWith(`${currentSessionId}:`),
    );
  }, [blockGroups, currentSessionId]);
  const matches = useMemo(
    () => findChatSearchMatches(blocks, query),
    [blocks, query],
  );

  // clamp inline so out-of-range indices never reach render without an effect round-trip
  const safeActiveIndex =
    matches.length === 0 ? 0 : Math.min(activeMatchIndex, matches.length - 1);
  const activeMatch = matches[safeActiveIndex];
  const activeMatchId = activeMatch?.id;
  const activeMatchNumber = matches.length > 0 ? safeActiveIndex + 1 : 0;

  useEffect(() => {
    if (!activeMatchId) return;
    const scrollToActiveMatch = () => {
      document.getElementById(activeMatchId)?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
      });
    };

    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      const frame = window.requestAnimationFrame(scrollToActiveMatch);
      return () => window.cancelAnimationFrame(frame);
    }
    scrollToActiveMatch();
  }, [activeMatchId]);

  const registerBlocks = useCallback(
    (groupId: string, nextBlocks: ChatSearchBlock[]) => {
      setBlockGroups((current) => ({
        ...current,
        [groupId]: nextBlocks,
      }));
    },
    [],
  );

  const unregisterBlocks = useCallback((groupId: string) => {
    setBlockGroups((current) => {
      if (!(groupId in current)) return current;
      const next = {...current};
      delete next[groupId];
      return next;
    });
  }, []);

  const matchesByBlock = useMemo(() => {
    const grouped = new Map<string, ChatSearchMatch[]>();
    for (const match of matches) {
      const existing = grouped.get(match.blockId);
      if (existing) {
        existing.push(match);
      } else {
        grouped.set(match.blockId, [match]);
      }
    }
    return grouped;
  }, [matches]);

  const getMatchesForBlock = useCallback(
    (blockId: string) => matchesByBlock.get(blockId) ?? [],
    [matchesByBlock],
  );

  const goToNextMatch = useCallback(() => {
    setActiveMatchIndex((index) => {
      if (matches.length === 0) return 0;
      const safe = Math.min(index, matches.length - 1);
      return (safe + 1) % matches.length;
    });
  }, [matches.length]);

  const goToPreviousMatch = useCallback(() => {
    setActiveMatchIndex((index) => {
      if (matches.length === 0) return 0;
      const safe = Math.min(index, matches.length - 1);
      return (safe - 1 + matches.length) % matches.length;
    });
  }, [matches.length]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setActiveMatchIndex(0);
  }, []);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      matches,
      activeMatchId,
      activeMatchNumber,
      registerBlocks,
      unregisterBlocks,
      getMatchesForBlock,
      goToNextMatch,
      goToPreviousMatch,
      clearSearch,
    }),
    [
      activeMatchId,
      activeMatchNumber,
      clearSearch,
      getMatchesForBlock,
      goToNextMatch,
      goToPreviousMatch,
      matches,
      query,
      registerBlocks,
      unregisterBlocks,
    ],
  );

  return (
    <ChatSearchContext.Provider value={value}>
      {children}
    </ChatSearchContext.Provider>
  );
};

export function useChatSearch(): ChatSearchContextValue {
  const context = useContext(ChatSearchContext);
  if (!context) {
    throw new Error('Chat.Search must be rendered inside Chat.Root.');
  }
  return context;
}

export function useOptionalChatSearch(): ChatSearchContextValue | null {
  return useContext(ChatSearchContext);
}

export function useRegisterChatSearchBlocks(
  groupId: string,
  blocks: ChatSearchBlock[],
): void {
  const search = useOptionalChatSearch();
  const registerBlocks = search?.registerBlocks;
  const unregisterBlocks = search?.unregisterBlocks;

  useEffect(() => {
    if (!registerBlocks || !unregisterBlocks) return;
    registerBlocks(groupId, blocks);
    return () => unregisterBlocks(groupId);
  }, [blocks, groupId, registerBlocks, unregisterBlocks]);
}

type ChatSearchProps = {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

export const ChatSearch: React.FC<ChatSearchProps> = ({
  className,
  placeholder = 'Search chat...',
  autoFocus = false,
}) => {
  const {
    query,
    setQuery,
    matches,
    activeMatchNumber,
    goToNextMatch,
    goToPreviousMatch,
    clearSearch,
  } = useChatSearch();
  const hasQuery = query.trim().length > 0;
  const hasMatches = matches.length > 0;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPreviousMatch();
        } else {
          goToNextMatch();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clearSearch();
      }
    },
    [clearSearch, goToNextMatch, goToPreviousMatch],
  );

  return (
    <div
      className={cn(
        'bg-muted/40 flex h-9 min-w-0 items-center gap-1 rounded-md border px-2',
        className,
      )}
    >
      <SearchIcon className="text-muted-foreground h-4 w-4 shrink-0" />
      <Input
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search chat"
        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
      />
      <span
        className="text-muted-foreground min-w-10 shrink-0 text-right text-xs tabular-nums"
        aria-live="polite"
      >
        {hasQuery ? `${activeMatchNumber}/${matches.length}` : '0/0'}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={goToPreviousMatch}
        disabled={!hasMatches}
        aria-label="Previous chat search match"
        title="Previous match"
      >
        <ChevronUpIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={goToNextMatch}
        disabled={!hasMatches}
        aria-label="Next chat search match"
        title="Next match"
      >
        <ChevronDownIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};

export function HighlightedChatSearchText({
  text,
  blockId,
}: {
  text: string;
  blockId: string;
}) {
  const search = useOptionalChatSearch();
  const matches = search?.getMatchesForBlock(blockId) ?? [];
  if (matches.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      parts.push(text.slice(cursor, match.start));
    }
    const isActive = search?.activeMatchId === match.id;
    parts.push(
      <mark
        key={match.id}
        id={match.id}
        className={cn(
          'm-0 rounded-sm p-0 leading-[inherit] [unicode-bidi:normal]',
          isActive
            ? // inset box-shadow instead of ring/border so active mark does not shift surrounding text by 1px
              'bg-editor-search-match-selected text-foreground shadow-[inset_0_0_0_1px_var(--color-ring)]'
            : 'bg-editor-search-match text-foreground',
        )}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
}

export function createChatSearchRehypePlugin({
  blockId,
  matches,
  activeMatchId,
}: {
  blockId: string;
  matches: ChatSearchMatch[];
  activeMatchId?: string;
}) {
  return () => (tree: unknown) => {
    if (matches.length === 0) return;

    const sortedMatches = [...matches].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return a.id.localeCompare(b.id);
    });

    let textOffset = 0;
    let matchIndex = 0;
    const transformTextNode = (node: any): any[] => {
      const value = node.value as string;
      const nodeStart = textOffset;
      const nodeEnd = nodeStart + value.length;

      while (matchIndex < sortedMatches.length) {
        const m = sortedMatches[matchIndex];
        if (!m || m.end > nodeStart) break;
        matchIndex += 1;
      }

      const nodeMatches: ChatSearchMatch[] = [];
      for (let i = matchIndex; i < sortedMatches.length; i += 1) {
        const match = sortedMatches[i];
        if (!match) break;
        if (match.start >= nodeEnd) break;
        if (match.end > nodeStart) {
          nodeMatches.push(match);
        }
      }

      textOffset = nodeEnd;

      if (nodeMatches.length === 0) return [node];

      const children: any[] = [];
      let cursor = 0;
      for (const match of nodeMatches) {
        const start = Math.max(match.start - nodeStart, 0);
        const end = Math.min(match.end - nodeStart, value.length);
        if (start > cursor) {
          children.push({type: 'text', value: value.slice(cursor, start)});
        }
        children.push({
          type: 'element',
          tagName: 'mark',
          properties: {
            id: match.id,
            className: [
              'p-0 m-0 leading-[inherit] [unicode-bidi:normal] rounded-sm',
              match.id === activeMatchId
                ? // inset box-shadow instead of ring/border so active mark does not shift surrounding text by 1px
                  'bg-editor-search-match-selected text-foreground shadow-[inset_0_0_0_1px_var(--color-ring)]'
                : 'bg-editor-search-match text-foreground',
            ],
            dataChatSearchBlockId: blockId,
          },
          children: [{type: 'text', value: value.slice(start, end)}],
        });
        cursor = end;
      }
      if (cursor < value.length) {
        children.push({type: 'text', value: value.slice(cursor)});
      }
      return children;
    };

    const visit = (node: any) => {
      if (!node) return;

      if (node.type === 'text' && typeof node.value === 'string') {
        transformTextNode(node);
        return;
      }

      if (Array.isArray(node.children)) {
        const nextChildren: any[] = [];
        for (const child of node.children) {
          if (child?.type === 'text' && typeof child.value === 'string') {
            nextChildren.push(...transformTextNode(child));
          } else {
            visit(child);
            nextChildren.push(child);
          }
        }
        node.children = nextChildren;
      }
    };

    visit(tree);
  };
}
