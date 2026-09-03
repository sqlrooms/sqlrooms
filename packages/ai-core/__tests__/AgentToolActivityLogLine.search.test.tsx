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
import type {AgentToolCall} from '../src/types';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {AgentToolActivityLogLine} =
  await import('../src/components/FlatAgentRenderer');
const {
  ChatSearchProvider,
  useChatSearch,
  useRegisterChatSearchBlocks,
  useReportRenderedChatSearchBlock,
} = await import('../src/components/ChatSearch');

const TOOL_BLOCK_ID = 'session-1:result-1:tool:0';

// When the label is a reasoning string, AgentToolActivityLogLine never
// mounts HighlightedChatSearchText for this block, so nothing reports it
// as rendered and it is excluded from the search index entirely. Force it
// into the rendered set here to isolate the slicing guard itself: given
// matches that exist for this block, the component must still refuse to
// highlight a label string the offsets do not belong to.
function ForceRenderedReporter({blockId}: {blockId: string}) {
  useReportRenderedChatSearchBlock(blockId);
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
          tools: {},
          toolRenderers: {},
          agentProgress: {},
          toolTimings: {},
        },
      }) as unknown as AiSliceState,
  ) as any;
}

// ChatTurnView indexes tool blocks with text: toolName, never the label.
function BlockRegistrar({toolName}: {toolName: string}) {
  useRegisterChatSearchBlocks('turn-1', [
    {id: TOOL_BLOCK_ID, resultId: 'result-1', text: toolName},
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

function renderLogLine(
  toolCall: AgentToolCall,
  options?: {forceRendered?: boolean},
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
          <BlockRegistrar toolName={toolCall.toolName} />
          {options?.forceRendered && (
            <ForceRenderedReporter blockId={TOOL_BLOCK_ID} />
          )}
          <AgentToolActivityLogLine
            toolCall={toolCall}
            searchBlockId={TOOL_BLOCK_ID}
          />
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

describe('AgentToolActivityLogLine search highlighting', () => {
  it('highlights the tool name when the label equals the tool name', () => {
    const toolCall: AgentToolCall = {
      toolCallId: 'call-1',
      toolName: 'run-query',
      state: 'success',
    };
    const {container, root} = renderLogLine(toolCall);

    setQuery('query');

    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('query');
    expect(container.textContent).toContain('run-query');

    cleanup(container, root);
  });

  it('does not highlight a reasoning label even though the query matches the tool name', () => {
    const toolCall: AgentToolCall = {
      toolCallId: 'call-2',
      toolName: 'run-query',
      state: 'success',
      input: {reasoning: 'Looking things up'},
    };
    const {container, root} = renderLogLine(toolCall, {forceRendered: true});

    setQuery('query');

    // Forced into the rendered set above so a match exists for this block,
    // but the rendered label is the reasoning string and must not be sliced
    // using offsets computed against the tool name.
    expect(latestSearchRef.current?.matches.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('Looking things up');
    expect(container.textContent).not.toContain('run-query');

    cleanup(container, root);
  });

  it('never reports the block as rendered when the label is a reasoning string, so it is excluded from the index', () => {
    const toolCall: AgentToolCall = {
      toolCallId: 'call-3',
      toolName: 'run-query',
      state: 'success',
      input: {reasoning: 'Looking things up'},
    };
    const {container, root} = renderLogLine(toolCall);

    setQuery('query');

    // With no HighlightedChatSearchText mounted for this label, nothing
    // reports the block as rendered, so it never enters the search index.
    expect(latestSearchRef.current?.matches).toHaveLength(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);

    cleanup(container, root);
  });
});
