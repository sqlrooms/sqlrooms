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
import type {ChatActivityProps} from '../src/components/ChatRenderingContext';

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
  MessageContent: ({content}: {content: string}) => (
    <div data-testid="message-content">{content}</div>
  ),
  processMessageContent: (content: string) => ({
    processedContent: content,
    thinkContent: undefined,
  }),
}));

jest.unstable_mockModule('../src/components/ToolPartRenderer', () => ({
  ToolPartRenderer: ({
    part,
    toolCallId,
  }: {
    part: {toolCallId?: string};
    toolCallId: string;
  }) => (
    <div data-testid="tool-part-renderer" data-tool-call-id={toolCallId}>
      agent:{part.toolCallId ?? toolCallId}
    </div>
  ),
}));

jest.unstable_mockModule('../src/components/FlatAgentRenderer', () => ({
  OrchestratorToolLogLine: ({
    part,
  }: {
    part: {input?: {reasoning?: string}; toolCallId?: string};
  }) => (
    <div data-testid="orchestrator-log">
      {part.input?.reasoning ?? 'tool-activity'}
    </div>
  ),
  HoistedToolCallRenderer: ({
    item,
  }: {
    item: {toolCallId: string; toolName: string};
  }) => (
    <div data-testid={`${item.toolName}-renderer`}>{item.toolCallId}</div>
  ),
}));

const {ChatTurnView} = await import('../src/components/ChatTurnView');
const {ChatRendering} = await import('../src/components/ChatRenderingContext');
const {DefaultChatActivity} = await import(
  '../src/components/defaultChatRendering'
);

function createTurn(parts: UIMessage['parts']): ChatTurn {
  return {
    id: 'user-1',
    prompt: 'Show datasets and a chart',
    userMessage: {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'Show datasets and a chart'}],
    },
    assistantMessages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts,
      },
    ],
    isCompleted: false,
  };
}

function renderTurn(options: {
  parts: UIMessage['parts'];
  wrapping?: (children: React.ReactNode) => React.ReactNode;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

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
  const toolRenderers = {
    chart: () => null,
    listH3HubDatasets: () => null,
  };
  const toolTimings = {};
  const agentProgress = {};

  const store = createStore<AiSliceState>(() => ({
    ai: {
      config: {
        currentSessionId: 'session-1',
        sessions: [session],
      },
      getCurrentSession: () => session,
      forkSessionFromMessage: jest.fn(),
      agentProgress,
      toolRenderers,
      toolTimings,
      setToolTiming: jest.fn(),
      tools: {},
    } as unknown as AiSliceState['ai'],
  }));

  const tree = (
    <RoomStateProvider roomStore={store}>
      <TooltipProvider>
        <ChatTurnView
          chatTurn={createTurn(options.parts)}
          hoistedRenderers={['chart', 'listH3HubDatasets']}
        />
      </TooltipProvider>
    </RoomStateProvider>
  );

  act(() => {
    root.render(options.wrapping ? options.wrapping(tree) : tree);
  });

  return {container, root};
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

const sampleParts: UIMessage['parts'] = [
  {type: 'text', text: 'Response intro'},
  {
    type: 'tool-listH3HubDatasets',
    toolCallId: 'list-1',
    state: 'output-available',
    input: {reasoning: 'Listing datasets'},
    output: {datasets: []},
  } as UIMessage['parts'][number],
  {
    type: 'tool-chart',
    toolCallId: 'chart-1',
    state: 'output-available',
    input: {},
    output: {spec: {}},
  } as UIMessage['parts'][number],
  {type: 'text', text: 'Final summary'},
];

describe('ChatTurnView layout', () => {
  it('keeps the interleaved SQLRooms default recipe without Chat.Rendering', () => {
    const {container, root} = renderTurn({parts: sampleParts});

    const activity = container.querySelectorAll(
      '[data-testid="chat-turn-activity"]',
    );
    expect(activity).toHaveLength(1);

    const text = container.textContent ?? '';
    const responsePos = text.indexOf('Response intro');
    const activityPos = text.indexOf('Listing datasets');
    const summaryPos = text.indexOf('Final summary');

    // Default recipe interleaves: response text, then tool activity/hoists, then summary.
    expect(responsePos).toBeGreaterThan(-1);
    expect(activityPos).toBeGreaterThan(-1);
    expect(summaryPos).toBeGreaterThan(-1);
    expect(responsePos).toBeLessThan(activityPos);
    expect(activityPos).toBeLessThan(summaryPos);

    // Default recipe has no Spatial activity product chrome.
    expect(container.querySelector('[data-testid="spatial-agent-thoughts"]')).toBeNull();

    cleanup(container, root);
  });

  it('merges a partial Activity override and keeps the default Turn', () => {
    const CustomActivity = ({children, summaryLabel}: ChatActivityProps) => (
      <div data-testid="custom-activity" data-summary={summaryLabel ?? ''}>
        {children}
      </div>
    );

    const {container, root} = renderTurn({
      parts: sampleParts,
      wrapping: (children) => (
        <ChatRendering components={{Activity: CustomActivity}}>
          {children}
        </ChatRendering>
      ),
    });

    expect(
      container.querySelectorAll('[data-testid="custom-activity"]'),
    ).toHaveLength(1);
    // Still the interleaved default turn (response before activity).
    const text = container.textContent ?? '';
    expect(text.indexOf('Response intro')).toBeLessThan(
      text.indexOf('Listing datasets'),
    );
    // Default Activity is not used.
    expect(CustomActivity).not.toBe(DefaultChatActivity);

    cleanup(container, root);
  });

  it('merges nested Chat.Rendering providers', () => {
    const OuterActivity = ({children}: ChatActivityProps) => (
      <div data-testid="outer-activity">{children}</div>
    );
    const InnerActivity = ({children}: ChatActivityProps) => (
      <div data-testid="inner-activity">{children}</div>
    );

    const {container, root} = renderTurn({
      parts: sampleParts,
      wrapping: (children) => (
        <ChatRendering components={{Activity: OuterActivity}}>
          <ChatRendering components={{Activity: InnerActivity}}>
            {children}
          </ChatRendering>
        </ChatRendering>
      ),
    });

    expect(
      container.querySelectorAll('[data-testid="inner-activity"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="outer-activity"]'),
    ).toHaveLength(0);

    cleanup(container, root);
  });
});
