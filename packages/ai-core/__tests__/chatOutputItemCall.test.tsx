/**
 * @jest-environment jsdom
 *
 * Hoisted output items carry their call, so a custom Turn can group or
 * summarise outputs by what they hold.
 */
import {TransformStream} from 'node:stream/web';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {ChatTurnPresentation} from '../src/components/ChatRenderingTypes';
import type {ToolRendererRegistry} from '../src/types';

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

const toolRenderers: ToolRendererRegistry = {chart: () => null};

/** Builds the presentation of a completed turn made of `parts`. */
function presentTurn(parts: UIMessagePart[]): ChatTurnPresentation {
  let turn: ChatTurnPresentation | undefined;
  function Harness() {
    const bindContent = useChatTurnContentBinder();
    turn = createChatTurnPresentation({
      turnId: 'turn-1',
      model: buildChatTurnModel({
        parts,
        agentProgress: {},
        toolRenderers,
        hoistableToolNames: new Set(['chart']),
      }),
      prompt: 'chart it',
      promptAttachments: [],
      isCompleted: true,
      searchBlockPrefix: 'session-1:turn-1',
      canFork: false,
      toolTimings: {},
      responseText: [],
      summaryText: [],
      components: defaultChatRenderingComponents,
      bindContent,
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
  act(() => root.unmount());
  if (!turn) throw new Error('turn was not presented');
  return turn;
}

describe('hoisted output items', () => {
  it('carry the hoisted call with its input and output', () => {
    const turn = presentTurn([
      {
        type: 'tool-chart',
        toolCallId: 'chart-1',
        state: 'output-available',
        input: {title: 'Sales'},
        output: {success: true, spec: {mark: 'bar'}},
      } as UIMessagePart,
    ]);

    expect(turn.hoistedOutputs.items).toHaveLength(1);
    expect(turn.hoistedOutputs.items[0]?.call).toMatchObject({
      toolCallId: 'chart-1',
      toolName: 'chart',
      state: 'success',
      input: {title: 'Sales'},
      output: {success: true, spec: {mark: 'bar'}},
    });
  });
});
