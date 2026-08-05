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
});
