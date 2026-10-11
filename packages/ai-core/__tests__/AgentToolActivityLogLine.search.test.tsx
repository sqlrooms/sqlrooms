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
import type {ToolPartWithId} from '../src/components/buildChatTurnModel';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {AgentToolActivityLogLine} =
  await import('../src/components/FlatAgentRenderer');
const {DefaultChatToolActivity} =
  await import('../src/components/defaultChatRendering');
const {ChatSearchProvider, useChatSearch, useRegisterChatSearchBlocks} =
  await import('../src/components/ChatSearch');

const TOOL_BLOCK_ID = 'session-1:result-1:tool:0';

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

function renderSearchableTool(toolName: string, content: React.ReactNode) {
  latestSearchRef.current = undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = createTestStore();

  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <ChatSearchProvider>
          <BlockRegistrar toolName={toolName} />
          {content}
          <SearchController />
        </ChatSearchProvider>
      </RoomStateProvider>,
    );
  });

  return {container, root, store};
}

function renderLogLine(toolCall: AgentToolCall) {
  return renderSearchableTool(
    toolCall.toolName,
    <AgentToolActivityLogLine
      toolCall={toolCall}
      searchBlockId={TOOL_BLOCK_ID}
    />,
  );
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

  it('highlights a reasoning label by its own text, and does not match the tool name', () => {
    const toolCall: AgentToolCall = {
      toolCallId: 'call-2',
      toolName: 'run-query',
      state: 'success',
      input: {reasoning: 'Looking things up'},
    };
    const {container, root} = renderLogLine(toolCall);

    setQuery('looking');
    expect(container.querySelector('mark')?.textContent).toBe('Looking');
    expect(container.textContent).toContain('Looking things up');

    setQuery('query');
    expect(latestSearchRef.current?.matches).toHaveLength(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);

    cleanup(container, root);
  });

  it('highlights a tool name with a trailing ellipsis', () => {
    const toolCall: AgentToolCall = {
      toolCallId: 'call-4',
      toolName: 'run-query...',
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
});

describe('AgentToolSummaryLine search highlighting', () => {
  it('indexes the reasoning shown for a top-level agent tool', () => {
    const toolCall: AgentToolCall = {
      toolCallId: 'agent-1',
      toolName: 'delegate-task',
      state: 'success',
      input: {reasoning: 'Inspecting the available datasets'},
      agentToolCalls: [
        {
          toolCallId: 'nested-1',
          toolName: 'list-datasets',
          state: 'success',
        },
      ],
    };
    const part = {
      type: 'tool-delegate-task',
      toolCallId: toolCall.toolCallId,
      state: 'output-available',
      input: toolCall.input,
      output: {agentToolCalls: toolCall.agentToolCalls},
    } as ToolPartWithId;
    const {container, root} = renderSearchableTool(
      toolCall.toolName,
      <DefaultChatToolActivity
        toolCall={toolCall}
        part={part}
        isAgent
        isHoisted={false}
        searchBlockId={TOOL_BLOCK_ID}
      />,
    );

    setQuery('available');
    expect(container.querySelector('mark')?.textContent).toBe('available');
    expect(latestSearchRef.current?.matches).toHaveLength(1);

    setQuery('delegate');
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(latestSearchRef.current?.matches).toHaveLength(0);

    cleanup(container, root);
  });
});
