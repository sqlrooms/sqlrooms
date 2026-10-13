/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand';
import type {AiSliceState} from '../src/AiSlice';
import type {
  ChatActivityProps,
  ChatToolActivityProps,
} from '../src/components/ChatRenderingContext';
import type {AgentToolCall} from '../src/types';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {ChatRendering} = await import('../src/components/ChatRenderingContext');
const {FlatAgentRenderer} = await import('../src/components/FlatAgentRenderer');
const {HoistedRenderersProvider} =
  await import('../src/components/HoistedRenderersContext');
const {RenderNestedHoistedOutputsProvider} =
  await import('../src/components/NestedHoistedOutputsContext');

describe('FlatAgentRenderer chat rendering slots', () => {
  it('routes nested activity boxes and tool rows through the configured slots', () => {
    const activityProps: ChatActivityProps[] = [];
    const toolActivityProps: ChatToolActivityProps[] = [];
    const CustomActivity: React.FC<ChatActivityProps> = (props) => {
      activityProps.push(props);
      return <section data-testid="custom-activity">{props.children}</section>;
    };
    const CustomToolActivity: React.FC<ChatToolActivityProps> = (props) => {
      toolActivityProps.push(props);
      return (
        <div
          data-testid="custom-tool-activity"
          data-tool-name={props.toolCall.toolName}
          data-agent={String(props.isAgent)}
        />
      );
    };
    const nestedCalls: AgentToolCall[] = [
      {
        toolCallId: 'inspect-1',
        toolName: 'inspect',
        input: {reasoning: 'Inspecting the data'},
        state: 'success',
      },
      {
        toolCallId: 'agent-1',
        toolName: 'agent-research',
        input: {reasoning: 'Delegating research'},
        state: 'success',
        agentToolCalls: [
          {
            toolCallId: 'query-1',
            toolName: 'query',
            input: {reasoning: 'Running a query'},
            state: 'success',
          },
        ],
      },
    ];
    const liveCall: AgentToolCall = {
      toolCallId: 'live-query-1',
      toolName: 'live-query',
      input: {reasoning: 'Running the latest query'},
      state: 'pending',
    };
    const store = createStore<AiSliceState>(() => ({
      ai: {
        tools: {},
        toolRenderers: {},
        agentProgress: {'agent-1': [liveCall]},
        toolTimings: {},
        setToolTiming: jest.fn(),
      } as unknown as AiSliceState['ai'],
    }));
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatRendering
            components={{
              Activity: CustomActivity,
              ToolActivity: CustomToolActivity,
            }}
          >
            <FlatAgentRenderer
              toolCallId="root-agent"
              agentToolCalls={nestedCalls}
              isComplete
            />
          </ChatRendering>
        </RoomStateProvider>,
      );
    });

    expect(
      container.querySelectorAll('[data-testid="custom-activity"]'),
    ).toHaveLength(2);
    expect(
      [
        ...container.querySelectorAll('[data-testid="custom-tool-activity"]'),
      ].map((element) => [
        element.getAttribute('data-tool-name'),
        element.getAttribute('data-agent'),
      ]),
    ).toEqual([
      ['inspect', 'false'],
      ['agent-research', 'true'],
      ['live-query', 'false'],
    ]);
    expect(
      activityProps.map(({toolCount, isCompleted}) => ({
        toolCount,
        isCompleted,
      })),
    ).toEqual([
      {toolCount: 1, isCompleted: true},
      {toolCount: 1, isCompleted: false},
    ]);
    expect(toolActivityProps.every(({part}) => part === undefined)).toBe(true);
    expect(
      toolActivityProps.find(({isAgent}) => isAgent)?.toolCall.agentToolCalls,
    ).toEqual([liveCall]);

    act(() => root.unmount());
  });

  it('keeps a completed child group incomplete while its parent is running', () => {
    const activityProps: ChatActivityProps[] = [];
    const CustomActivity: React.FC<ChatActivityProps> = (props) => {
      activityProps.push(props);
      return <section>{props.children}</section>;
    };
    const completedCall: AgentToolCall = {
      toolCallId: 'query-1',
      toolName: 'query',
      state: 'success',
    };
    const store = createStore<AiSliceState>(() => ({
      ai: {
        tools: {},
        toolRenderers: {},
        agentProgress: {},
        toolTimings: {},
        setToolTiming: jest.fn(),
      } as unknown as AiSliceState['ai'],
    }));
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ChatRendering components={{Activity: CustomActivity}}>
            <FlatAgentRenderer
              toolCallId="root-agent"
              agentToolCalls={[completedCall]}
              isComplete={false}
            />
          </ChatRendering>
        </RoomStateProvider>,
      );
    });

    expect(activityProps).toHaveLength(1);
    expect(activityProps[0]).toMatchObject({
      isRunning: false,
      isCompleted: false,
      toolCount: 1,
    });

    act(() => root.unmount());
  });

  describe('a listed agent nested inside another agent', () => {
    const nestedAgent: AgentToolCall = {
      toolCallId: 'build-1',
      toolName: 'buildMap',
      input: {reasoning: 'Building the map'},
      state: 'success',
      output: {success: true},
      agentToolCalls: [
        {
          toolCallId: 'query-1',
          toolName: 'query',
          input: {reasoning: 'Running a query'},
          state: 'success',
        },
      ],
    };

    /** Renders the tree; returns hoisted outputs and tool rows in DOM order. */
    function renderOrder(renderNestedHoistedOutputs: boolean): string[] {
      const store = createStore<AiSliceState>(() => ({
        ai: {
          tools: {},
          toolRenderers: {buildMap: () => null},
          agentProgress: {},
          toolTimings: {},
          setToolTiming: jest.fn(),
        } as unknown as AiSliceState['ai'],
      }));
      const container = document.createElement('div');
      const root = createRoot(container);

      act(() => {
        root.render(
          <RoomStateProvider roomStore={store}>
            <HoistedRenderersProvider value={['buildMap']}>
              <RenderNestedHoistedOutputsProvider
                value={renderNestedHoistedOutputs}
              >
                <ChatRendering
                  components={{
                    // Pass-through, so nested rows are in the DOM.
                    Activity: ({children}) => <>{children}</>,
                    ToolActivity: ({toolCall, isHoisted}) => (
                      <div
                        data-order={`row:${toolCall.toolName}:${String(isHoisted)}`}
                      />
                    ),
                    HoistedOutput: ({item}) => (
                      <div data-order={`hoisted:${item.toolCallId}`} />
                    ),
                  }}
                >
                  <FlatAgentRenderer
                    toolCallId="root-agent"
                    agentToolCalls={[nestedAgent]}
                    isComplete
                  />
                </ChatRendering>
              </RenderNestedHoistedOutputsProvider>
            </HoistedRenderersProvider>
          </RoomStateProvider>,
        );
      });

      const order = Array.from(
        container.querySelectorAll('[data-order]'),
        (node) => node.getAttribute('data-order') ?? '',
      );
      act(() => root.unmount());
      return order;
    }

    it('draws its own output ahead of its activity and marks the row hoisted', () => {
      expect(renderOrder(true)).toEqual([
        'hoisted:build-1',
        'row:buildMap:true',
        'row:query:false',
      ]);
    });

    it('leaves its output to the turn when nested outputs are drawn there', () => {
      expect(renderOrder(false)).toEqual([
        'row:buildMap:true',
        'row:query:false',
      ]);
    });
  });
});
