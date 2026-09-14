/**
 * @jest-environment jsdom
 *
 * What the default Turn hands each timeline tool group: a label while the
 * group runs, and the group's own timing — as raw milliseconds as well as a
 * ready-made label — once it settles. A host that overrides only `Activity`
 * relies on these props.
 */
import {TransformStream} from 'node:stream/web';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {ChatActivityProps} from '../src/components/ChatRenderingTypes';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {buildChatTurnModel} =
  await import('../src/components/buildChatTurnModel');
const {createChatTurnPresentation, defaultChatRenderingComponents} =
  await import('../src/components/defaultChatRendering');
const {useChatTurnContentBinder} =
  await import('../src/components/useChatTurnContentBinder');

const TOOL_TIMINGS = {
  'query-1': {startedAt: 1_000, completedAt: 4_000},
  'query-2': {startedAt: 2_000, completedAt: 13_000},
};

function toolPart(toolCallId: string, state: string): UIMessagePart {
  return {
    type: 'tool-query',
    toolCallId,
    state,
    input: {sql: 'select 1'},
    ...(state === 'output-available' ? {output: {rows: 1}} : {}),
  } as UIMessagePart;
}

/** Renders the timeline with a stub `Activity` that records the props it got. */
function renderTimeline(args: {parts: UIMessagePart[]; isCompleted: boolean}) {
  const seen: ChatActivityProps[] = [];
  const Activity = (props: ChatActivityProps) => {
    seen.push(props);
    return null;
  };

  function Harness() {
    const bindContent = useChatTurnContentBinder();
    const model = buildChatTurnModel({
      parts: args.parts,
      agentProgress: {},
      toolRenderers: {},
      hoistableToolNames: new Set<string>(),
    });
    const presentation = createChatTurnPresentation({
      turnId: 'turn-1',
      model,
      prompt: 'hello',
      promptAttachments: [],
      isCompleted: args.isCompleted,
      searchBlockPrefix: 'session-1:turn-1',
      canFork: false,
      toolTimings: TOOL_TIMINGS,
      responseText: [],
      summaryText: [],
      components: {...defaultChatRenderingComponents, Activity},
      bindContent,
    });
    const Timeline = presentation.timeline.Content;
    return <Timeline />;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(<Harness />));
  act(() => root.unmount());
  container.remove();
  return seen;
}

describe('timeline tool-group activities', () => {
  it('reports the group duration once it settles', () => {
    const [activity] = renderTimeline({
      parts: [
        toolPart('query-1', 'output-available'),
        toolPart('query-2', 'output-available'),
      ],
      isCompleted: true,
    });

    expect(activity).toMatchObject({
      isRunning: false,
      toolCount: 2,
      summaryLabel: 'Worked with 2 tools',
      // Earliest start to latest completion across the whole group.
      startedAt: 1_000,
      computationTimeMs: 12_000,
      computationTimeLabel: 'Computation Time: 12s',
    });
  });

  it('names a running group and withholds a duration it does not have yet', () => {
    const [activity] = renderTimeline({
      parts: [
        toolPart('query-1', 'output-available'),
        toolPart('query-2', 'input-available'),
      ],
      isCompleted: false,
    });

    expect(activity).toMatchObject({
      isRunning: true,
      summaryLabel: 'Thinking',
      startedAt: 1_000,
    });
    expect(activity?.computationTimeMs).toBeUndefined();
    expect(activity?.computationTimeLabel).toBeUndefined();
  });
});
