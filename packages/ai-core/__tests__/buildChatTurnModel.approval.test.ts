import type {UIMessagePart} from '@sqlrooms/ai-config';
import type {AgentToolCall} from '../src/types';
import {buildChatTurnModel} from '../src/components/buildChatTurnModel';

function build(args: {
  parts: UIMessagePart[];
  agentProgress?: Record<string, AgentToolCall[]>;
}) {
  return buildChatTurnModel({
    parts: args.parts,
    agentProgress: args.agentProgress ?? {},
    toolRenderers: {},
    hoistableToolNames: new Set<string>(),
  });
}

function toolPart(toolCallId: string, state: string): UIMessagePart {
  return {
    type: 'tool-query',
    toolCallId,
    state,
    input: {sql: 'select 1'},
    ...(state === 'output-available' ? {output: {rows: 1}} : {}),
  } as UIMessagePart;
}

function agentPart(toolCallId: string, state: string): UIMessagePart {
  return {
    type: 'tool-agent',
    toolCallId,
    state,
    input: {task: 'dig in'},
  } as UIMessagePart;
}

describe('buildChatTurnModel approval state', () => {
  it('separates waiting on the user from working', () => {
    const model = build({parts: [toolPart('query-1', 'approval-requested')]});
    expect(model.isActivityRunning).toBe(true);
    expect(model.isAwaitingApproval).toBe(true);
  });

  it('is not awaiting approval for a call that is merely unfinished', () => {
    const model = build({parts: [toolPart('query-1', 'input-available')]});
    expect(model.isActivityRunning).toBe(true);
    expect(model.isAwaitingApproval).toBe(false);
  });

  it('sees an approval requested by a nested agent call', () => {
    const model = build({
      parts: [agentPart('agent-1', 'input-available')],
      agentProgress: {
        'agent-1': [
          {toolCallId: 'nested-1', toolName: 'query', state: 'success'},
          {
            toolCallId: 'nested-2',
            toolName: 'deleteItem',
            state: 'approval-requested',
          },
        ],
      },
    });
    expect(model.isAwaitingApproval).toBe(true);
  });

  it('sees an approval nested two agents deep', () => {
    const model = build({
      parts: [agentPart('agent-1', 'input-available')],
      agentProgress: {
        'agent-1': [
          {toolCallId: 'agent-2', toolName: 'agent', state: 'pending'},
        ],
        'agent-2': [
          {
            toolCallId: 'nested-1',
            toolName: 'deleteItem',
            state: 'approval-requested',
          },
        ],
      },
    });
    expect(model.isAwaitingApproval).toBe(true);
  });

  it('clears once every call has settled', () => {
    const model = build({parts: [toolPart('query-1', 'output-available')]});
    expect(model.isActivityRunning).toBe(false);
    expect(model.isAwaitingApproval).toBe(false);
  });
});
