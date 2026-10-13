/**
 * @jest-environment jsdom
 *
 * A tool that runs a sub-agent and hoists its own result, rendered through the
 * real chat components: turn model, presentation, tool part renderer, flat
 * agent renderer and default hoisted output. Each step and each card must be
 * drawn exactly once, in the default Timeline and in the decomposed activity
 * and hoisted-output regions alike.
 */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {TransformStream} from 'node:stream/web';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand';
import type {AiSliceState} from '../src/AiSlice';
import type {ChatActivityProps} from '../src/components/ChatRenderingTypes';
import type {ToolRenderBehavior} from '../src/components/FlatAgentRenderer';
import type {
  AgentToolCall,
  ToolRendererProps,
  ToolRendererRegistry,
} from '../src/types';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {buildChatTurnModel} =
  await import('../src/components/buildChatTurnModel');
const {ChatRendering, useChatRenderingComponents} =
  await import('../src/components/ChatRenderingContext');
const {createChatTurnPresentation} =
  await import('../src/components/defaultChatRendering');
const {FlatAgentRenderer, ToolRenderBehaviorProvider} =
  await import('../src/components/FlatAgentRenderer');
const {HoistedRenderersProvider} =
  await import('../src/components/HoistedRenderersContext');
const {useChatTurnContentBinder} =
  await import('../src/components/useChatTurnContentBinder');

type Layout = 'timeline' | 'decomposed';

// The default activity box collapses a settled group to its header; a
// pass-through keeps every row in the DOM so it can be counted.
const PassThroughActivity = ({children}: ChatActivityProps) => <>{children}</>;

/** Renders one completed turn; returns what it drew. */
function renderTurn(options: {
  layout: Layout;
  part: UIMessagePart;
  toolRenderers: ToolRendererRegistry;
  hoistedRenderers: string[];
  /** Tools with a client `execute`; others are renderer-only. */
  executableTools?: string[];
  toolRenderBehavior?: ToolRenderBehavior;
}) {
  const tools = Object.fromEntries(
    (options.executableTools ?? []).map((name) => [name, {execute: jest.fn()}]),
  );
  const store = createStore<AiSliceState>(() => ({
    ai: {
      tools,
      toolRenderers: options.toolRenderers,
      agentProgress: {},
      toolTimings: {},
      setToolTiming: jest.fn(),
    } as unknown as AiSliceState['ai'],
  }));
  const hoistableToolNames = new Set(options.hoistedRenderers);

  function Turn() {
    const components = useChatRenderingComponents();
    const bindContent = useChatTurnContentBinder();
    const turn = createChatTurnPresentation({
      turnId: 'turn-1',
      model: buildChatTurnModel({
        parts: [options.part],
        agentProgress: {},
        toolRenderers: options.toolRenderers,
        hoistableToolNames,
      }),
      prompt: 'make a map',
      promptAttachments: [],
      isCompleted: true,
      searchBlockPrefix: 'session-1:turn-1',
      canFork: false,
      toolTimings: {},
      responseText: [],
      summaryText: [],
      components,
      bindContent,
    });
    if (options.layout === 'timeline') {
      const Timeline = turn.timeline.Content;
      return <Timeline />;
    }
    const Activity = turn.activity.Content;
    const Outputs = turn.hoistedOutputs.Content;
    return (
      <>
        <div data-region="activity">
          <Activity />
        </div>
        <div data-region="outputs">
          <Outputs />
        </div>
      </>
    );
  }

  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(
      <RoomStateProvider roomStore={store}>
        <HoistedRenderersProvider value={options.hoistedRenderers}>
          <ToolRenderBehaviorProvider value={options.toolRenderBehavior ?? {}}>
            <ChatRendering components={{Activity: PassThroughActivity}}>
              <Turn />
            </ChatRendering>
          </ToolRenderBehaviorProvider>
        </HoistedRenderersProvider>
      </RoomStateProvider>,
    );
  });
  const text = container.textContent ?? '';
  const drawn = {
    /** How many times `label` appears in the turn's text. */
    count: (label: string) => text.split(label).length - 1,
    /** Card test ids in DOM order. */
    cards: Array.from(
      container.querySelectorAll('[data-testid$="-card"]'),
      (node) => node.getAttribute('data-testid'),
    ),
    activityHtml:
      container.querySelector('[data-region="activity"]')?.innerHTML ?? null,
    warnings: warn.mock.calls.map((args) => String(args[0])),
  };
  act(() => root.unmount());
  warn.mockRestore();
  return drawn;
}

const step = (
  toolCallId: string,
  toolName: string,
  reasoning: string,
): AgentToolCall => ({
  toolCallId,
  toolName,
  input: {reasoning},
  state: 'success',
  output: {success: true},
});

/** A card that also shows its sub-agent's steps, as some renderers do. */
const BuildMapCard = ({
  toolCallId,
  output,
}: ToolRendererProps<{agentToolCalls?: AgentToolCall[]}>) => (
  <div data-testid="map-card">
    <FlatAgentRenderer
      toolCallId={toolCallId}
      agentToolCalls={output?.agentToolCalls ?? []}
      isComplete
    />
  </div>
);
const ChartCard = () => <div data-testid="chart-card" />;

const buildMapSteps: AgentToolCall[] = [
  step('query-1', 'query', 'Running a query'),
  step('chart-1', 'chart', 'Drawing a chart'),
];

describe.each<Layout>(['timeline', 'decomposed'])(
  'a hoisted agent result in the %s layout',
  (layout) => {
    it('draws the steps its card embeds once, in the activity', () => {
      const drawn = renderTurn({
        layout,
        part: {
          type: 'tool-buildMap',
          toolCallId: 'build-1',
          state: 'output-available',
          input: {},
          output: {success: true, agentToolCalls: buildMapSteps},
        } as UIMessagePart,
        toolRenderers: {buildMap: BuildMapCard, chart: ChartCard},
        hoistedRenderers: ['buildMap', 'chart'],
      });

      expect(drawn.count('Running a query')).toBe(1);
      expect(drawn.count('Drawing a chart')).toBe(1);
      expect(drawn.cards).toEqual(['map-card', 'chart-card']);
    });

    it('draws the steps its card embeds once when it is nested in another agent', () => {
      const drawn = renderTurn({
        layout,
        part: {
          type: 'tool-agent-analyst',
          toolCallId: 'analyst-1',
          state: 'output-available',
          input: {},
          output: {
            agentToolCalls: [
              {
                ...step('build-1', 'buildMap', 'Building the map'),
                output: {success: true, agentToolCalls: buildMapSteps},
                agentToolCalls: buildMapSteps,
              },
            ],
          },
        } as UIMessagePart,
        toolRenderers: {buildMap: BuildMapCard, chart: ChartCard},
        hoistedRenderers: ['buildMap', 'chart'],
        executableTools: ['agent-analyst'],
      });

      expect(drawn.count('Running a query')).toBe(1);
      expect(drawn.count('Drawing a chart')).toBe(1);
      expect(drawn.cards).toEqual(['map-card', 'chart-card']);
    });

    it('draws nothing in the activity when its sub-agent took no steps', () => {
      const drawn = renderTurn({
        layout,
        part: {
          type: 'tool-agent-build',
          toolCallId: 'build-1',
          state: 'output-available',
          input: {},
          output: {success: true},
        } as UIMessagePart,
        toolRenderers: {'agent-build': () => <div data-testid="build-card" />},
        hoistedRenderers: ['agent-build'],
      });

      expect(drawn.cards).toEqual(['build-card']);
      expect(drawn.warnings).toEqual([]);
      if (layout === 'decomposed') expect(drawn.activityHtml).toBe('');
    });

    it('still draws the result of a listed passthrough agent, ahead of its steps', () => {
      const drawn = renderTurn({
        layout,
        part: {
          type: 'tool-agent-analyst',
          toolCallId: 'analyst-1',
          state: 'output-available',
          input: {},
          output: {
            agentToolCalls: [
              {
                ...step('skill-1', 'runSkill', 'Running the skill'),
                agentToolCalls: [step('chart-1', 'chart', 'Drawing a chart')],
              },
            ],
          },
        } as UIMessagePart,
        toolRenderers: {
          runSkill: () => <div data-testid="skill-card" />,
          chart: ChartCard,
        },
        hoistedRenderers: ['runSkill', 'chart'],
        executableTools: ['agent-analyst'],
        toolRenderBehavior: {
          isPassthroughTool: (toolCall) => toolCall.toolName === 'runSkill',
        },
      });

      expect(drawn.cards).toEqual(['skill-card', 'chart-card']);
      expect(drawn.count('Drawing a chart')).toBe(1);
    });
  },
);
