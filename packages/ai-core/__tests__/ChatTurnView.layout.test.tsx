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
import {TOOL_CALL_CANCELLED} from '../src/constants';
import type {ChatActivityProps} from '../src/components/ChatRenderingContext';
import type {
  ChatActionsProps,
  ChatErrorProps,
  ChatHoistedOutputProps,
  ChatToolActivityProps,
  ChatTurnSlotProps,
} from '../src/components/ChatRenderingContext';
import {useRenderNestedHoistedOutputs} from '../src/components/NestedHoistedOutputsContext';

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
    part: {
      toolCallId?: string;
      output?: {agentToolCalls?: Array<{toolCallId: string}>};
    };
    toolCallId: string;
  }) => {
    const renderNestedHoistedOutputs = useRenderNestedHoistedOutputs();
    return (
      <div data-testid="tool-part-renderer" data-tool-call-id={toolCallId}>
        agent:{part.toolCallId ?? toolCallId}
        {renderNestedHoistedOutputs
          ? part.output?.agentToolCalls?.map((call) => (
              <div key={call.toolCallId} data-testid="nested-local-hoist">
                {call.toolCallId}
              </div>
            ))
          : null}
      </div>
    );
  },
}));

jest.unstable_mockModule('../src/components/FlatAgentRenderer', () => ({
  AgentToolActivityLogLine: ({toolCall}: {toolCall: {toolName: string}}) => (
    <div data-testid="agent-tool-log">{toolCall.toolName}</div>
  ),
  AgentToolSummaryLine: ({toolCall}: {toolCall: {toolName: string}}) => (
    <div data-testid="agent-tool-summary">{toolCall.toolName}</div>
  ),
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
  }) => <div data-testid={`${item.toolName}-renderer`}>{item.toolCallId}</div>,
}));

const {ChatTurnView} = await import('../src/components/ChatTurnView');
const {ChatRendering} = await import('../src/components/ChatRenderingContext');
const {DefaultChatActivity} =
  await import('../src/components/defaultChatRendering');

function createTurn(
  parts: UIMessage['parts'],
  options: {isCompleted?: boolean; errorMessage?: string} = {},
): ChatTurn {
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
    isCompleted: options.isCompleted ?? false,
    ...(options.errorMessage
      ? {errorMessage: {error: options.errorMessage}}
      : {}),
  };
}

function renderTurn(options: {
  parts: UIMessage['parts'];
  wrapping?: (children: React.ReactNode) => React.ReactNode;
  isCompleted?: boolean;
  errorMessage?: string;
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

  const forkSessionFromMessage = jest.fn();
  const setToolTiming = jest.fn();
  const store = createStore<AiSliceState>(() => ({
    ai: {
      config: {
        currentSessionId: 'session-1',
        sessions: [session],
      },
      getCurrentSession: () => session,
      forkSessionFromMessage,
      agentProgress,
      toolRenderers,
      toolTimings,
      setToolTiming,
      tools: {},
    } as unknown as AiSliceState['ai'],
  }));

  const tree = (
    <RoomStateProvider roomStore={store}>
      <TooltipProvider>
        <ChatTurnView
          chatTurn={createTurn(options.parts, options)}
          hoistedRenderers={['chart', 'listH3HubDatasets']}
        />
      </TooltipProvider>
    </RoomStateProvider>
  );

  act(() => {
    root.render(options.wrapping ? options.wrapping(tree) : tree);
  });

  return {container, root, forkSessionFromMessage, setToolTiming};
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

const nestedAgentParts: UIMessage['parts'] = [
  {
    type: 'tool-agent-research',
    toolCallId: 'agent-1',
    state: 'output-available',
    input: {reasoning: 'Researching'},
    output: {
      agentToolCalls: [
        {
          toolCallId: 'nested-chart-1',
          toolName: 'chart',
          state: 'success',
          input: {},
          output: {spec: {}},
        },
      ],
    },
  } as UIMessage['parts'][number],
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
    expect(
      container.querySelector('[data-testid="spatial-agent-thoughts"]'),
    ).toBeNull();

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

  it('routes hoisted output through a partial slot override', () => {
    const CustomHoistedOutput = ({item}: ChatHoistedOutputProps) => (
      <div data-testid="custom-hoisted-output">{item.toolCallId}</div>
    );

    const {container, root} = renderTurn({
      parts: sampleParts,
      wrapping: (children) => (
        <ChatRendering components={{HoistedOutput: CustomHoistedOutput}}>
          {children}
        </ChatRendering>
      ),
    });

    expect(
      Array.from(
        container.querySelectorAll('[data-testid="custom-hoisted-output"]'),
      ).map((element) => element.textContent),
    ).toEqual(['list-1', 'chart-1']);

    cleanup(container, root);
  });

  it('keeps nested hoists in the default source-order timeline', () => {
    const {container, root} = renderTurn({parts: nestedAgentParts});

    expect(
      container.querySelectorAll('[data-testid="nested-local-hoist"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="chart-renderer"]'),
    ).toHaveLength(0);

    cleanup(container, root);
  });

  it('renders nested hoists once in a decomposed custom turn', () => {
    const CustomTurn = ({turn}: ChatTurnSlotProps) => {
      const Activity = turn.activity.Content;
      const HoistedOutputs = turn.hoistedOutputs.Content;
      return (
        <article>
          <Activity />
          <HoistedOutputs />
        </article>
      );
    };

    const {container, root} = renderTurn({
      parts: nestedAgentParts,
      wrapping: (children) => (
        <ChatRendering
          nestedActivityMode="embed"
          components={{Turn: CustomTurn}}
        >
          {children}
        </ChatRendering>
      ),
    });

    expect(
      container.querySelectorAll('[data-testid="nested-local-hoist"]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-testid="chart-renderer"]'),
    ).toHaveLength(1);

    cleanup(container, root);
  });

  it('records timing independently of ToolActivity rendering', () => {
    const renderedToolActivity: ChatToolActivityProps[] = [];
    const HiddenToolActivity: React.FC<ChatToolActivityProps> = (props) => {
      renderedToolActivity.push(props);
      return null;
    };
    const {container, root, setToolTiming} = renderTurn({
      parts: [
        {
          type: 'tool-plain',
          toolCallId: 'plain-1',
          state: 'input-available',
          input: {},
        } as UIMessage['parts'][number],
      ],
      wrapping: (children) => (
        <ChatRendering components={{ToolActivity: HiddenToolActivity}}>
          {children}
        </ChatRendering>
      ),
    });

    expect(setToolTiming).toHaveBeenCalledWith('plain-1', {
      startedAt: expect.any(Number),
    });
    expect(renderedToolActivity[0]).toMatchObject({
      toolCall: {
        toolCallId: 'plain-1',
        toolName: 'plain',
        input: {},
        state: 'pending',
      },
      part: {toolCallId: 'plain-1'},
      index: 0,
      isAgent: false,
      isHoisted: false,
    });

    cleanup(container, root);
  });

  it('marks reasoning-only incomplete activity as running', () => {
    const CustomActivity = ({children, isRunning}: ChatActivityProps) => (
      <div data-testid="custom-activity" data-running={isRunning}>
        {children}
      </div>
    );
    const CustomTurn = ({turn}: ChatTurnSlotProps) => {
      const Activity = turn.activity.Content;
      return (
        <article
          data-testid="custom-turn"
          data-running={turn.activity.isRunning}
        >
          <Activity />
        </article>
      );
    };
    const {container, root} = renderTurn({
      parts: [{type: 'reasoning', text: 'Still thinking'}],
      isCompleted: false,
      wrapping: (children) => (
        <ChatRendering
          components={{Turn: CustomTurn, Activity: CustomActivity}}
        >
          {children}
        </ChatRendering>
      ),
    });

    expect(
      container
        .querySelector('[data-testid="custom-turn"]')
        ?.getAttribute('data-running'),
    ).toBe('true');
    expect(
      container
        .querySelector('[data-testid="custom-activity"]')
        ?.getAttribute('data-running'),
    ).toBe('true');

    cleanup(container, root);
  });

  it('lets an Actions override hide Fork while keeping pre-wired Copy', () => {
    const CustomActions = ({copy}: ChatActionsProps) => {
      const Copy = copy?.Content;
      return (
        <div data-testid="custom-actions">
          {Copy && <Copy />}
          <button type="button">Custom action</button>
        </div>
      );
    };
    const {container, root} = renderTurn({
      parts: sampleParts,
      isCompleted: true,
      wrapping: (children) => (
        <ChatRendering components={{Actions: CustomActions}}>
          {children}
        </ChatRendering>
      ),
    });

    expect(
      container.querySelector('[data-testid="custom-actions"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Copy message"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Fork chat from this message"]'),
    ).toBeNull();
    expect(container.textContent).toContain('Custom action');

    cleanup(container, root);
  });

  it('lets an Actions override replace Fork visuals without rebuilding behavior', () => {
    const CustomActions = ({fork}: ChatActionsProps) =>
      fork ? (
        <button type="button" data-testid="custom-fork" onClick={fork.run}>
          Branch here
        </button>
      ) : null;
    const {container, root, forkSessionFromMessage} = renderTurn({
      parts: sampleParts,
      isCompleted: true,
      wrapping: (children) => (
        <ChatRendering components={{Actions: CustomActions}}>
          {children}
        </ChatRendering>
      ),
    });

    act(() => {
      (
        container.querySelector('[data-testid="custom-fork"]') as HTMLElement
      ).click();
    });
    expect(forkSessionFromMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSessionId: 'session-1',
        sourceMessageId: 'assistant-1',
        sourceTurnId: 'user-1',
      }),
    );

    cleanup(container, root);
  });

  it('routes turn errors through a region separate from Actions', () => {
    const CustomError = ({message}: ChatErrorProps) => (
      <div data-testid="custom-error">Error: {message}</div>
    );
    const CustomActions = (props: ChatActionsProps) => (
      <div
        data-testid="custom-actions"
        data-action-keys={Object.keys(props).sort().join(',')}
      />
    );
    const {container, root} = renderTurn({
      parts: sampleParts,
      errorMessage: 'Request failed',
      wrapping: (children) => (
        <ChatRendering
          components={{Error: CustomError, Actions: CustomActions}}
        >
          {children}
        </ChatRendering>
      ),
    });

    expect(
      container.querySelector('[data-testid="custom-error"]')?.textContent,
    ).toBe('Error: Request failed');
    expect(
      container
        .querySelector('[data-testid="custom-actions"]')
        ?.getAttribute('data-action-keys'),
    ).toBe('copy');

    cleanup(container, root);
  });

  it('does not expose cancellation as a turn error region', () => {
    const CustomError = ({message}: ChatErrorProps) => (
      <div data-testid="custom-error">{message}</div>
    );
    const {container, root} = renderTurn({
      parts: sampleParts,
      errorMessage: TOOL_CALL_CANCELLED,
      wrapping: (children) => (
        <ChatRendering components={{Error: CustomError}}>
          {children}
        </ChatRendering>
      ),
    });

    expect(container.querySelector('[data-testid="custom-error"]')).toBeNull();

    cleanup(container, root);
  });

  it('lets a custom Turn inspect semantics and reorder pre-wired regions', () => {
    const CustomTurn = ({turn}: ChatTurnSlotProps) => {
      const Prompt = turn.prompt.Content;
      const Activity = turn.activity.Content;
      const Response = turn.response.Content;
      const HoistedOutputs = turn.hoistedOutputs.Content;
      const Summary = turn.summary.Content;
      const Error = turn.error?.Content;
      const Actions = turn.actions.Content;
      return (
        <article
          data-testid="custom-turn"
          data-turn-id={turn.id}
          data-tool-count={turn.activity.toolCount}
          data-activity-kinds={turn.activity.items
            .map((item) => item.kind)
            .join(',')}
          data-tool-states={turn.activity.items
            .filter((item) => item.kind === 'tool')
            .map((item) => item.state)
            .join(',')}
        >
          <Prompt />
          <Activity />
          <Response />
          <HoistedOutputs />
          <Summary />
          {Error && <Error />}
          <Actions />
        </article>
      );
    };

    const {container, root} = renderTurn({
      parts: sampleParts,
      wrapping: (children) => (
        <ChatRendering
          nestedActivityMode="embed"
          components={{Turn: CustomTurn}}
        >
          {children}
        </ChatRendering>
      ),
    });

    const customTurn = container.querySelector('[data-testid="custom-turn"]');
    expect(customTurn?.getAttribute('data-turn-id')).toBe('user-1');
    expect(customTurn?.getAttribute('data-tool-count')).toBe('2');
    expect(customTurn?.getAttribute('data-activity-kinds')).toBe('tool,tool');
    expect(customTurn?.getAttribute('data-tool-states')).toBe(
      'success,success',
    );
    const text = customTurn?.textContent ?? '';
    // Assert presence before comparing positions: indexOf returns -1 for
    // missing text, which would otherwise make the ordering assertions pass
    // even if a piece of content disappeared from the custom turn.
    const markers = [
      'Listing datasets',
      'Response intro',
      'list-1',
      'Final summary',
    ] as const;
    for (const marker of markers) {
      expect(text.indexOf(marker)).toBeGreaterThanOrEqual(0);
    }
    expect(text.indexOf('Listing datasets')).toBeLessThan(
      text.indexOf('Response intro'),
    );
    expect(text.indexOf('Response intro')).toBeLessThan(text.indexOf('list-1'));
    expect(text.indexOf('list-1')).toBeLessThan(text.indexOf('Final summary'));

    cleanup(container, root);
  });
});
