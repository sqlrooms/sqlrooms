/**
 * @jest-environment jsdom
 */
import {TransformStream} from 'node:stream/web';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import React from 'react';
import type {AgentToolCall, ToolRendererRegistry} from '../src/types';

Object.assign(globalThis, {TransformStream});

const {buildChatTurnRenderPlan} =
  await import('../src/components/buildChatTurnRenderPlan');

const chartRenderer = () => null;
const listRenderer = () => null;
const mapRenderer = () => null;

const toolRenderers: ToolRendererRegistry = {
  chart: chartRenderer,
  listH3HubDatasets: listRenderer,
  executeApi: mapRenderer,
};

const hoistable = new Set(['chart', 'listH3HubDatasets', 'executeApi']);

function text(text: string): UIMessagePart {
  return {type: 'text', text};
}

function reasoning(text: string): UIMessagePart {
  return {type: 'reasoning', text};
}

function toolPart(
  name: string,
  opts: {
    toolCallId?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  } = {},
): UIMessagePart {
  return {
    type: `tool-${name}`,
    toolCallId: opts.toolCallId ?? `${name}-1`,
    state: opts.state ?? 'output-available',
    input: opts.input ?? {},
    ...(opts.state === 'output-error'
      ? {errorText: opts.errorText ?? 'failed'}
      : {output: opts.output}),
  } as UIMessagePart;
}

describe('buildChatTurnRenderPlan', () => {
  it('keeps all text as response when nothing is hoistable', () => {
    const parts: UIMessagePart[] = [
      text('Hello'),
      toolPart('query', {toolCallId: 'q1', output: {ok: true}}),
      text('Done'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.responseText.map((t) => t.text)).toEqual(['Hello', 'Done']);
    expect(plan.summaryText).toEqual([]);
    expect(plan.hoisted).toEqual([]);
    expect(plan.leafToolCount).toBe(1);
    expect(plan.activity).toHaveLength(1);
    expect(plan.activity[0]).toMatchObject({kind: 'tool', isAgent: false});
  });

  it('splits response and summary around the first hoist-producing call', () => {
    const parts: UIMessagePart[] = [
      text('Looking at datasets'),
      toolPart('listH3HubDatasets', {
        toolCallId: 'list-1',
        output: {datasets: []},
      }),
      text('Here is the summary'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.responseText.map((t) => t.text)).toEqual([
      'Looking at datasets',
    ]);
    expect(plan.summaryText.map((t) => t.text)).toEqual([
      'Here is the summary',
    ]);
    expect(plan.hoisted).toEqual([
      expect.objectContaining({
        toolCallId: 'list-1',
        toolName: 'listH3HubDatasets',
        state: 'success',
      }),
    ]);
  });

  it('collects nested hoistables from agent tools in depth-first order', () => {
    const nested: AgentToolCall[] = [
      {
        toolCallId: 'chart-1',
        toolName: 'chart',
        state: 'success',
        output: {spec: {}},
      },
      {
        toolCallId: 'query-1',
        toolName: 'query',
        state: 'success',
        output: {rows: 1},
      },
      {
        toolCallId: 'list-1',
        toolName: 'listH3HubDatasets',
        state: 'success',
        output: {datasets: []},
      },
    ];

    const parts: UIMessagePart[] = [
      text('I will analyze'),
      toolPart('agent-analysis', {
        toolCallId: 'agent-1',
        output: {agentToolCalls: nested, finalOutput: 'ok'},
      }),
      text('Summary after map'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.activity).toHaveLength(1);
    expect(plan.activity[0]).toMatchObject({
      kind: 'tool',
      isAgent: true,
    });
    expect(plan.hoisted.map((h) => h.toolCallId)).toEqual([
      'chart-1',
      'list-1',
    ]);
    expect(plan.leafToolCount).toBe(3);
    expect(plan.responseText.map((t) => t.text)).toEqual(['I will analyze']);
    expect(plan.summaryText.map((t) => t.text)).toEqual(['Summary after map']);
  });

  it('uses live agentProgress over persisted nested calls', () => {
    const persisted: AgentToolCall[] = [
      {
        toolCallId: 'old-chart',
        toolName: 'chart',
        state: 'success',
        output: {spec: {old: true}},
      },
    ];
    const live: AgentToolCall[] = [
      {
        toolCallId: 'live-chart',
        toolName: 'chart',
        state: 'success',
        output: {spec: {live: true}},
      },
    ];

    const parts: UIMessagePart[] = [
      toolPart('agent-analysis', {
        toolCallId: 'agent-1',
        output: {agentToolCalls: persisted},
      }),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {'agent-1': live},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.hoisted.map((h) => h.toolCallId)).toEqual(['live-chart']);
  });

  it('dedupes hoisted tools by toolCallId', () => {
    const nested: AgentToolCall[] = [
      {
        toolCallId: 'chart-1',
        toolName: 'chart',
        state: 'success',
        output: {spec: {}},
        agentToolCalls: [
          {
            toolCallId: 'chart-1',
            toolName: 'chart',
            state: 'success',
            output: {spec: {}},
          },
        ],
      },
    ];

    const parts: UIMessagePart[] = [
      toolPart('agent-analysis', {
        toolCallId: 'agent-1',
        output: {agentToolCalls: nested},
      }),
      toolPart('chart', {
        toolCallId: 'chart-1',
        output: {spec: {}},
      }),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.hoisted.map((h) => h.toolCallId)).toEqual(['chart-1']);
  });

  it('puts reasoning into activity and preserves multiple hoistables', () => {
    const parts: UIMessagePart[] = [
      reasoning('Planning the query'),
      text('Response intro'),
      toolPart('chart', {toolCallId: 'c1', output: {spec: {}}}),
      toolPart('listH3HubDatasets', {
        toolCallId: 'l1',
        output: {datasets: []},
      }),
      text('Final summary'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.activity[0]).toMatchObject({
      kind: 'reasoning',
      text: 'Planning the query',
    });
    expect(plan.hoisted.map((h) => h.toolName)).toEqual([
      'chart',
      'listH3HubDatasets',
    ]);
    expect(plan.responseText.map((t) => t.text)).toEqual(['Response intro']);
    expect(plan.summaryText.map((t) => t.text)).toEqual(['Final summary']);
  });

  it('marks activity running for pending tools and nested pending agents', () => {
    const pendingPlan = buildChatTurnRenderPlan({
      parts: [
        toolPart('query', {
          toolCallId: 'q1',
          state: 'input-available',
          input: {},
        }),
      ],
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });
    expect(pendingPlan.isActivityRunning).toBe(true);

    const nestedPending: AgentToolCall[] = [
      {
        toolCallId: 'chart-1',
        toolName: 'chart',
        state: 'pending',
      },
    ];
    const agentPlan = buildChatTurnRenderPlan({
      parts: [
        toolPart('agent-analysis', {
          toolCallId: 'agent-1',
          state: 'input-available',
          input: {},
        }),
      ],
      agentProgress: {'agent-1': nestedPending},
      toolRenderers,
      hoistableToolNames: hoistable,
    });
    expect(agentPlan.isActivityRunning).toBe(true);
    expect(agentPlan.activity[0]).toMatchObject({isAgent: true});
  });

  it('does not hoist pending or streaming hoistable tools', () => {
    const parts: UIMessagePart[] = [
      toolPart('chart', {
        toolCallId: 'c1',
        state: 'input-available',
        input: {},
      }),
      toolPart('chart', {
        toolCallId: 'c2',
        state: 'input-streaming',
        input: {},
      }),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    // Both are tracked as activity (running), but neither is hoisted
    // because HoistedToolCallRenderer renders nothing for pending states.
    expect(plan.activity).toHaveLength(2);
    expect(plan.isActivityRunning).toBe(true);
    expect(plan.hoisted).toEqual([]);
  });

  it('hoists approval-requested hoistable tools', () => {
    const parts: UIMessagePart[] = [
      toolPart('chart', {
        toolCallId: 'c1',
        state: 'approval-requested',
        input: {},
      }),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.hoisted).toEqual([
      expect.objectContaining({
        toolCallId: 'c1',
        state: 'approval-requested',
      }),
    ]);
  });

  it('does not hoist nested pending tools from agent calls', () => {
    const nested: AgentToolCall[] = [
      {
        toolCallId: 'chart-pending',
        toolName: 'chart',
        state: 'pending',
      },
      {
        toolCallId: 'chart-done',
        toolName: 'chart',
        state: 'success',
        output: {spec: {}},
      },
    ];

    const parts: UIMessagePart[] = [
      toolPart('agent-analysis', {
        toolCallId: 'agent-1',
        output: {agentToolCalls: nested},
      }),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {'agent-1': nested},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.hoisted.map((h) => h.toolCallId)).toEqual(['chart-done']);
  });

  it('includes error tools in activity without hoisting them', () => {
    const parts: UIMessagePart[] = [
      toolPart('chart', {
        toolCallId: 'c1',
        state: 'output-error',
        errorText: 'boom',
      }),
      text('Failed'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.activity).toHaveLength(1);
    // Error tools render nothing when hoisted (HoistedToolCallRenderer
    // returns null for non-success/non-approval states), so they must not
    // be collected — otherwise ChatTurnView emits empty wrapper divs.
    expect(plan.hoisted).toEqual([]);
    // Nothing hoisted ⇒ text stays in responseText, not summaryText.
    expect(plan.responseText.map((t) => t.text)).toEqual(['Failed']);
    expect(plan.summaryText).toEqual([]);
  });

  it('suppresses text duplicated by the next tool reasoning field', () => {
    const parts: UIMessagePart[] = [
      text('Thinking about roads'),
      toolPart('query', {
        toolCallId: 'q1',
        input: {reasoning: 'Thinking about roads'},
        output: {},
      }),
      text('Answer'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers,
      hoistableToolNames: hoistable,
    });

    expect(plan.responseText.map((t) => t.text)).toEqual(['Answer']);
    expect(plan.activity).toHaveLength(1);
  });

  it('skips hoistable tools whose renderer.shouldHoist returns false', () => {
    const executeApiRenderer = Object.assign(() => null, {
      shouldHoist: ({output}: {output: unknown}) =>
        (output as {apiName?: string} | undefined)?.apiName ===
        'listH3HubDatasets',
    });
    const renderers: ToolRendererRegistry = {
      ...toolRenderers,
      executeApi: executeApiRenderer,
    };
    const hoistableWithApi = new Set([...hoistable, 'executeApi']);

    const parts: UIMessagePart[] = [
      text('Working'),
      toolPart('executeApi', {
        toolCallId: 'q-api',
        output: {apiName: 'query', success: true},
      }),
      toolPart('executeApi', {
        toolCallId: 'list-api',
        output: {apiName: 'listH3HubDatasets', datasets: [{datasetName: 'a'}]},
      }),
      text('Done'),
    ];

    const plan = buildChatTurnRenderPlan({
      parts,
      agentProgress: {},
      toolRenderers: renderers,
      hoistableToolNames: hoistableWithApi,
    });

    // Only the visual executeApi call is hoisted; the query call is not,
    // so it does not create an empty slot or pull the split earlier.
    expect(plan.hoisted.map((h) => h.toolCallId)).toEqual(['list-api']);
    expect(plan.responseText.map((t) => t.text)).toEqual(['Working']);
    expect(plan.summaryText.map((t) => t.text)).toEqual(['Done']);
  });

  it('does not hoist nested tools when renderer.shouldHoist returns false', () => {
    const executeApiRenderer = Object.assign(() => null, {
      shouldHoist: () => false,
    });
    const renderers: ToolRendererRegistry = {
      ...toolRenderers,
      executeApi: executeApiRenderer,
    };

    const nested: AgentToolCall[] = [
      {
        toolCallId: 'api-1',
        toolName: 'executeApi',
        state: 'success',
        output: {apiName: 'query', success: true},
      },
      {
        toolCallId: 'chart-1',
        toolName: 'chart',
        state: 'success',
        output: {spec: {}},
      },
    ];

    const plan = buildChatTurnRenderPlan({
      parts: [
        toolPart('agent-analysis', {
          toolCallId: 'agent-1',
          output: {agentToolCalls: nested},
        }),
      ],
      agentProgress: {'agent-1': nested},
      toolRenderers: renderers,
      hoistableToolNames: new Set([...hoistable, 'executeApi']),
    });

    expect(plan.hoisted.map((h) => h.toolCallId)).toEqual(['chart-1']);
  });

  it('supports memoized tool renderers and normalizes shouldHoist state', () => {
    const states: string[] = [];
    const memoizedRenderer = Object.assign(
      React.memo(function MemoizedRenderer() {
        return null;
      }),
      {
        shouldHoist: ({state}: {state: string}) => {
          states.push(state);
          return state === 'success';
        },
      },
    );
    const renderers: ToolRendererRegistry = {
      ...toolRenderers,
      memoized: memoizedRenderer,
    };

    const plan = buildChatTurnRenderPlan({
      parts: [
        toolPart('memoized', {
          toolCallId: 'memoized-1',
          state: 'output-available',
          output: {ok: true},
        }),
      ],
      agentProgress: {},
      toolRenderers: renderers,
      hoistableToolNames: new Set(['memoized']),
    });

    expect(plan.hoisted.map((item) => item.toolCallId)).toEqual(['memoized-1']);
    expect(states).toEqual(['success']);
  });
});
