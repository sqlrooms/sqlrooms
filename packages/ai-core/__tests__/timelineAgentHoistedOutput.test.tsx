/**
 * @jest-environment jsdom
 *
 * The default Timeline owns hoisted outputs in source order, so an agent tool
 * that hoists its own result (its renderer opts in) must show that result
 * there too, in its hoisted slot ahead of the agent's activity row: the same
 * order as `turn.hoistedOutputs`. That the row then skips the tool's own
 * component is covered by ToolPartRenderer.test.tsx.
 */
import {jest} from '@jest/globals';
import {TransformStream} from 'node:stream/web';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {ChatHoistedOutputProps} from '../src/components/ChatRenderingTypes';
import type {AgentToolCall, ToolRendererRegistry} from '../src/types';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

// The agent row draws its activity, nested outputs and any approval UI through
// the store-bound ToolPartRenderer; a marker stands in for all of it.
jest.unstable_mockModule('../src/components/ToolPartRenderer', () => ({
  ToolPartRenderer: () => <div data-order="agent-activity" />,
}));

const {buildChatTurnModel} =
  await import('../src/components/buildChatTurnModel');
const {createChatTurnPresentation, defaultChatRenderingComponents} =
  await import('../src/components/defaultChatRendering');
const {useChatTurnContentBinder} =
  await import('../src/components/useChatTurnContentBinder');

const toolRenderers: ToolRendererRegistry = {
  buildMap: Object.assign(() => null, {
    shouldHoist: ({output}: {output: unknown}) =>
      (output as {success?: boolean} | undefined)?.success === true,
  }),
  'agent-review': Object.assign(() => null, {
    shouldHoist: ({state}: {state: string}) => state === 'approval-requested',
  }),
};

/** Renders the default Timeline; returns hoisted slots and agent rows in DOM order. */
function renderTimelineOrder(
  part: UIMessagePart,
  agentProgress: Record<string, AgentToolCall[]>,
): string[] {
  const HoistedOutput = ({item}: ChatHoistedOutputProps) => (
    <div data-order={`hoisted:${item.toolCallId}`} />
  );

  function Harness() {
    const bindContent = useChatTurnContentBinder();
    const model = buildChatTurnModel({
      parts: [part],
      agentProgress,
      toolRenderers,
      hoistableToolNames: new Set(['buildMap', 'agent-review']),
    });
    const presentation = createChatTurnPresentation({
      turnId: 'turn-1',
      model,
      prompt: 'make a map',
      promptAttachments: [],
      isCompleted: true,
      searchBlockPrefix: 'session-1:turn-1',
      canFork: false,
      toolTimings: {},
      responseText: [],
      summaryText: [],
      components: {
        ...defaultChatRenderingComponents,
        ToolActivity: () => null,
        HoistedOutput,
      },
      bindContent,
    });
    const Timeline = presentation.timeline.Content;
    return <Timeline />;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(<Harness />));
  const order = Array.from(
    container.querySelectorAll('[data-order]'),
    (node) => node.getAttribute('data-order') ?? '',
  );
  act(() => root.unmount());
  container.remove();
  return order;
}

describe('timeline agent tools with their own hoisted output', () => {
  it('draws the agent result in its hoisted slot, ahead of its activity row', () => {
    expect(
      renderTimelineOrder(
        {
          type: 'tool-buildMap',
          toolCallId: 'build-1',
          state: 'output-available',
          input: {},
          output: {success: true},
        } as UIMessagePart,
        {
          'build-1': [
            {toolCallId: 'query-1', toolName: 'query', state: 'success'},
          ],
        },
      ),
    ).toEqual(['hoisted:build-1', 'agent-activity']);
  });

  it('draws an agent approval request in its hoisted slot like any listed tool', () => {
    // An `agent-*` tool awaiting approval has not run, so it has no progress.
    expect(
      renderTimelineOrder(
        {
          type: 'tool-agent-review',
          toolCallId: 'review-1',
          state: 'approval-requested',
          input: {},
          approval: {id: 'approval-1'},
        } as UIMessagePart,
        {},
      ),
    ).toEqual(['hoisted:review-1', 'agent-activity']);
  });
});
