/**
 * @jest-environment jsdom
 *
 * The default Timeline owns hoisted outputs in source order, so an agent tool
 * that hoists its own result (its renderer opts in) must show that result
 * there too: once, right after the agent's activity.
 */
import {jest} from '@jest/globals';
import {TransformStream} from 'node:stream/web';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {ChatHoistedOutputProps} from '../src/components/ChatRenderingTypes';
import type {AgentToolCall, ToolRendererRegistry} from '../src/types';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

// The agent row draws its nested progress through the store-bound
// ToolPartRenderer; this test is only about where hoisted output lands.
jest.unstable_mockModule('../src/components/ToolPartRenderer', () => ({
  ToolPartRenderer: () => null,
}));

const {buildChatTurnModel} =
  await import('../src/components/buildChatTurnModel');
const {createChatTurnPresentation, defaultChatRenderingComponents} =
  await import('../src/components/defaultChatRendering');
const {useChatTurnContentBinder} =
  await import('../src/components/useChatTurnContentBinder');

const nested: AgentToolCall[] = [
  {toolCallId: 'query-1', toolName: 'query', state: 'success', output: {}},
];

const toolRenderers: ToolRendererRegistry = {
  buildMap: Object.assign(() => null, {
    shouldHoist: ({output}: {output: unknown}) =>
      (output as {success?: boolean} | undefined)?.success === true,
  }),
};

function agentPart(output: unknown): UIMessagePart {
  return {
    type: 'tool-buildMap',
    toolCallId: 'build-1',
    state: 'output-available',
    input: {},
    output,
  } as UIMessagePart;
}

/** Renders the default Timeline and returns the ids of hoisted outputs drawn. */
function renderTimelineHoisted(parts: UIMessagePart[]): string[] {
  const drawn: string[] = [];
  const HoistedOutput = ({item}: ChatHoistedOutputProps) => {
    drawn.push(item.toolCallId);
    return null;
  };

  function Harness() {
    const bindContent = useChatTurnContentBinder();
    const model = buildChatTurnModel({
      parts,
      agentProgress: {'build-1': nested},
      toolRenderers,
      hoistableToolNames: new Set(['buildMap']),
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
  act(() => root.unmount());
  container.remove();
  return drawn;
}

describe('timeline agent tools with their own hoisted output', () => {
  it('draws the agent result once', () => {
    expect(
      renderTimelineHoisted([
        agentPart({success: true, agentToolCalls: nested}),
      ]),
    ).toEqual(['build-1']);
  });

  it('draws nothing for an agent whose renderer declines', () => {
    expect(
      renderTimelineHoisted([
        agentPart({success: false, agentToolCalls: nested}),
      ]),
    ).toEqual([]);
  });
});
