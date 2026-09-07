/**
 * @jest-environment jsdom
 */
import React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {createStore} from 'zustand';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TooltipProvider} from '@sqlrooms/ui';
import {TransformStream} from 'node:stream/web';
import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import type {AiSliceState} from '../src/AiSlice';
import type {ChatTurn} from '../src/chatTurns';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  TransformStream,
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

jest.unstable_mockModule('../src/components/MessageContent', () => ({
  getChatSearchExcludedMarkdownTags: () => [],
  MessageContent: ({content}: {content: string}) => (
    <div data-testid="message-content">{content}</div>
  ),
  processMessageContent: (content: string) => ({
    processedContent: content,
    thinkContent: undefined,
  }),
}));

jest.unstable_mockModule('../src/components/ToolPartRenderer', () => ({
  ToolPartRenderer: () => null,
}));

const mountCounts = new Map<string, number>();

jest.unstable_mockModule('../src/components/FlatAgentRenderer', () => ({
  AgentToolActivityLogLine: () => <div data-testid="agent-tool-log" />,
  AgentToolSummaryLine: () => <div data-testid="agent-tool-summary" />,
  OrchestratorToolLogLine: () => <div data-testid="orchestrator-log" />,
  HoistedToolCallRenderer: ({item}: {item: {toolCallId: string}}) => {
    React.useEffect(() => {
      mountCounts.set(
        item.toolCallId,
        (mountCounts.get(item.toolCallId) ?? 0) + 1,
      );
    }, [item.toolCallId]);
    return <div data-testid="hoisted-renderer">{item.toolCallId}</div>;
  },
}));

const {ChatTurnView} = await import('../src/components/ChatTurnView');

function createTurn(parts: UIMessage['parts']): ChatTurn {
  return {
    id: 'user-1',
    prompt: 'Show a chart',
    userMessage: {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'Show a chart'}],
    },
    assistantMessages: [{id: 'assistant-1', role: 'assistant', parts}],
    isCompleted: false,
  };
}

function createStoreForTurn() {
  const session = {
    id: 'session-1',
    name: 'test',
    modelProvider: 'openai',
    model: 'gpt-4.1',
    createdAt: new Date(),
    uiMessages: [] as UIMessage[],
    messagesRevision: 0,
    prompt: '',
    isRunning: false,
  };

  return createStore<AiSliceState>(() => ({
    ai: {
      config: {currentSessionId: 'session-1', sessions: [session]},
      getCurrentSession: () => session,
      forkSessionFromMessage: jest.fn(),
      agentProgress: {},
      toolRenderers: {chart: () => null},
      toolTimings: {},
      setToolTiming: jest.fn(),
      tools: {},
    } as unknown as AiSliceState['ai'],
  }));
}

const chartPart = {
  type: 'tool-chart',
  toolCallId: 'chart-1',
  state: 'output-available',
  input: {},
  output: {spec: {}},
} as UIMessage['parts'][number];

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

describe('ChatTurnView content stability', () => {
  beforeEach(() => {
    mountCounts.clear();
  });

  it('does not remount hoisted output when the turn model rebuilds', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = createStoreForTurn();

    const render = (parts: UIMessage['parts']) => {
      act(() => {
        root.render(
          <RoomStateProvider roomStore={store}>
            <TooltipProvider>
              <ChatTurnView
                chatTurn={createTurn(parts)}
                // New array identity on every render, as app code commonly does.
                hoistedRenderers={['chart']}
              />
            </TooltipProvider>
          </RoomStateProvider>,
        );
      });
    };

    render([chartPart, {type: 'text', text: 'Streaming'}]);
    expect(mountCounts.get('chart-1')).toBe(1);

    // Simulate a streaming update: new text token extends the turn.
    render([chartPart, {type: 'text', text: 'Streaming answer'}]);
    expect(mountCounts.get('chart-1')).toBe(1);

    render([chartPart, {type: 'text', text: 'Streaming answer done'}]);
    expect(mountCounts.get('chart-1')).toBe(1);

    cleanup(container, root);
  });
});
