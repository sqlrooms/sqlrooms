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
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import {useStoreWithAi} from '../AiSlice';
import {markdownSanitizeSchema} from './markdown-sanitize';

const markdownHastProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, {allowDangerousHtml: true})
  .use(rehypeRaw)
  .use(rehypeSanitize, markdownSanitizeSchema);

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

/** Stable empty arrays so inactive search never churns context/effect deps. */
export const EMPTY_CHAT_SEARCH_BLOCKS: ChatSearchBlock[] = [];
const EMPTY_SEARCH_MATCHES: ChatSearchMatch[] = [];

function areChatSearchBlocksEqual(
  a: ChatSearchBlock[] | undefined,
  b: ChatSearchBlock[],
): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      !left ||
      !right ||
      left.id !== right.id ||
      left.resultId !== right.resultId ||
      left.text !== right.text
    ) {
      return false;
    }
  }
  return true;
}

/**
 * State and actions shared by `Chat.Root`'s search provider.
 *
 * `registerBlocks`/`unregisterBlocks` declare which text exists to search
 * (per turn group), independent of whether anything painted it on screen.
 * `reportRenderedBlock` is the rendered-set half: a slot calls
 * `reportRenderedBlock(blockId, text)` on mount and calls the function it
 * returns on unmount. A block stays indexed as long as at least one call's
 * release has not run yet, and the text matched against is the text passed
 * by whichever live call reported most recently, so an earlier reporter
 * releasing after a later one never makes the block fall back to stale text.
 * A block that registered but was never reported as rendered is excluded
 * from search entirely.
 */
export type ChatSearchContextValue = {
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
  reportRenderedBlock: (blockId: string, text?: string) => () => void;
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
  if (!normalizedQuery) return EMPTY_SEARCH_MATCHES;

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
  // One entry per live reporter (not a count), so StrictMode's double
  // mount/unmount, and fast remounts during streaming, never drop a block
  // that is still on screen, and a block never loses its text to a reporter
  // that already unmounted. Each entry is keyed by a token unique to the
  // call that created it, so a release only ever removes its own entry.
  const [renderedBlocks, setRenderedBlocks] = useState<
    Record<string, Array<{token: object; text?: string}>>
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
    const sessionBlocks = currentSessionId
      ? allBlocks.filter((block) => block.id.startsWith(`${currentSessionId}:`))
      : allBlocks;
    // Rendered-set intersection: only blocks a presentation recipe actually
    // mounted are indexable, so highlights and navigation never point at
    // content the user cannot see. When a rendered instance reported its own
    // painted text, that text replaces the registered text so offsets are
    // always computed against what is actually on screen.
    const result: ChatSearchBlock[] = [];
    for (const block of sessionBlocks) {
      const rendered = renderedBlocks[block.id];
      if (!rendered || rendered.length === 0) continue;
      // The most recently reported live reporter wins. This way, when it
      // unmounts, the block falls back to a reporter that is still mounted
      // instead of keeping text nothing paints.
      const latestText = rendered[rendered.length - 1]?.text;
      result.push(
        latestText !== undefined ? {...block, text: latestText} : block,
      );
    }
    return result;
  }, [blockGroups, currentSessionId, renderedBlocks]);
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
      setBlockGroups((current) => {
        // Bail out when content is unchanged so registration effects that
        // receive a fresh [] / equivalent array do not re-render the provider
        // (which previously fed max-update-depth loops via ChatTurnView).
        if (areChatSearchBlocksEqual(current[groupId], nextBlocks)) {
          return current;
        }
        return {
          ...current,
          [groupId]: nextBlocks,
        };
      });
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

  const reportRenderedBlock = useCallback((blockId: string, text?: string) => {
    const token = {};
    setRenderedBlocks((current) => {
      const existing = current[blockId] ?? [];
      return {
        ...current,
        [blockId]: [...existing, {token, text}],
      };
    });

    return () => {
      setRenderedBlocks((current) => {
        const existing = current[blockId];
        if (!existing) return current;
        const next = existing.filter((reporter) => reporter.token !== token);
        // Bail out with the same reference when there is nothing to remove,
        // matching registerBlocks's equality guard against update-depth loops.
        if (next.length === existing.length) return current;
        if (next.length === 0) {
          const rest = {...current};
          delete rest[blockId];
          return rest;
        }
        return {...current, [blockId]: next};
      });
    };
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
    (blockId: string) => matchesByBlock.get(blockId) ?? EMPTY_SEARCH_MATCHES,
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
      reportRenderedBlock,
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
      reportRenderedBlock,
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

/** Returns the enclosing `Chat.Root` search context, or `null` when rendered outside one. */
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

  // Keep registration updates separate from unmount cleanup. Combining them
  // in one effect means every `blocks` identity change unregisters then
  // re-registers (two setStates), amplifying streaming churn.
  useEffect(() => {
    if (!registerBlocks) return;
    registerBlocks(groupId, blocks);
  }, [blocks, groupId, registerBlocks]);

  useEffect(() => {
    if (!unregisterBlocks) return;
    return () => unregisterBlocks(groupId);
  }, [groupId, unregisterBlocks]);
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

/**
 * Marks `blockId` as on screen for the lifetime of the calling component, so
 * it joins the search index's rendered-set intersection. Reports on mount
 * and whenever `text` changes, releases on unmount. When `text` is given, it
 * becomes the string search offsets are computed against for this block,
 * replacing whatever text the block was registered with; omit it when the
 * slot's own highlighting mechanism (e.g. a rehype plugin) already matches
 * offsets to the registered text itself.
 */
export function useReportRenderedChatSearchBlock(
  blockId?: string,
  text?: string,
): void {
  const search = useOptionalChatSearch();
  const reportRenderedBlock = search?.reportRenderedBlock;

  useEffect(() => {
    if (!blockId || !reportRenderedBlock) return;
    return reportRenderedBlock(blockId, text);
  }, [blockId, text, reportRenderedBlock]);
}

/**
 * The id of `blockId`'s currently active search match, or undefined. Useful
 * for a slot that hides its content behind a disclosure or toggle: keying an
 * effect on the returned id (rather than a boolean) makes each navigation
 * step observable, even when it moves between two matches in the same
 * block, so the slot can reveal itself for every selected match, not just
 * the first. Callers that only need presence can wrap the result in
 * `Boolean(...)`.
 */
export function useActiveChatSearchMatchId(
  blockId?: string,
): string | undefined {
  const search = useOptionalChatSearch();
  if (!search || !blockId || !search.activeMatchId) return undefined;
  const isActiveInBlock = search
    .getMatchesForBlock(blockId)
    .some((match) => match.id === search.activeMatchId);
  return isActiveInBlock ? search.activeMatchId : undefined;
}

/**
 * Renders `text` with search matches wrapped in `<mark>`. `text` must be the
 * exact string this call reports as rendered for `blockId`: it both supplies
 * the offsets are matched against and the characters that get sliced, so a
 * caller showing a transformed or shortened string is searched by that
 * string, not by whatever the block was originally registered with.
 */
export function HighlightedChatSearchText({
  text,
  blockId,
}: {
  text: string;
  blockId: string;
}) {
  useReportRenderedChatSearchBlock(blockId, text);
  const search = useOptionalChatSearch();
  const matches = search?.getMatchesForBlock(blockId) ?? EMPTY_SEARCH_MATCHES;
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
