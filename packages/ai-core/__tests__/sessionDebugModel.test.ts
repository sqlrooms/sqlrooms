import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import {
  getAvailableToolDebugInfo,
  getSessionDebugAgentProgress,
  getSessionDebugAgentSnapshots,
  getSessionDebugMessages,
  getSessionDebugSummary,
  getSessionDebugToolCalls,
} from '../src/devtools/sessionDebugModel';

function createSession(): ChatSessionSchema {
  return {
    id: 'session-1',
    name: 'Debug session',
    modelProvider: 'openai',
    model: 'gpt-4.1',
    createdAt: new Date('2026-06-18T00:00:00Z'),
    uiMessages: [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'show the data'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {type: 'text', text: 'I will query it.'},
          {
            type: 'tool-query',
            toolCallId: 'call-1',
            state: 'output-available',
            input: {sql: 'select 1'},
            output: {rows: [{value: 1}]},
          },
        ],
      },
    ],
    messagesRevision: 0,
    prompt: '',
    isRunning: false,
    lastOpenedAt: 42,
    agentProgress: {
      'call-1': [
        {
          toolCallId: 'agent-call-1',
          toolName: 'inspect_table',
          state: 'success',
          input: {table: 'sales'},
          output: {ok: true},
        },
      ],
    },
    agentSnapshots: {
      'call-1': {
        parentToolCallId: 'call-1',
        agentName: 'agent-query',
        availableTools: [{name: 'inspect_table', description: 'Inspect'}],
        startedAt: 1,
      },
    },
  };
}

describe('sessionDebugModel', () => {
  it('summarizes chat sessions', () => {
    const summary = getSessionDebugSummary(createSession());

    expect(summary).toMatchObject({
      sessionId: 'session-1',
      name: 'Debug session',
      modelProvider: 'openai',
      model: 'gpt-4.1',
      messageCount: 2,
      userMessageCount: 1,
      assistantMessageCount: 1,
      toolCallCount: 1,
      agentProgressCount: 1,
      agentSnapshotCount: 1,
    });
  });

  it('derives message rows with text previews', () => {
    const messages = getSessionDebugMessages(createSession());

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: 'user-1',
      role: 'user',
      textPreview: 'show the data',
    });
  });

  it('derives tool call rows and marks agent progress', () => {
    const session = createSession();
    const toolCalls = getSessionDebugToolCalls(session, session.agentProgress);

    expect(toolCalls).toEqual([
      expect.objectContaining({
        messageId: 'assistant-1',
        toolCallId: 'call-1',
        toolName: 'query',
        state: 'output-available',
        hasAgentProgress: true,
      }),
    ]);
  });

  it('prefers live agent progress over persisted progress', () => {
    const entries = getSessionDebugAgentProgress(createSession(), {
      'call-1': [
        {
          toolCallId: 'live-call',
          toolName: 'live_tool',
          state: 'pending',
        },
      ],
    });

    expect(entries).toEqual([
      {
        parentToolCallId: 'call-1',
        source: 'live',
        toolCalls: [
          {
            toolCallId: 'live-call',
            toolName: 'live_tool',
            state: 'pending',
          },
        ],
      },
    ]);
  });

  it('prefers live agent snapshots over persisted snapshots', () => {
    const entries = getSessionDebugAgentSnapshots(createSession(), {
      'call-1': {
        parentToolCallId: 'call-1',
        agentName: 'live-agent',
        availableTools: [{name: 'live_tool'}],
        startedAt: 2,
      },
    });

    expect(entries).toEqual([
      {
        parentToolCallId: 'call-1',
        source: 'live',
        snapshot: {
          parentToolCallId: 'call-1',
          agentName: 'live-agent',
          availableTools: [{name: 'live_tool'}],
          startedAt: 2,
        },
      },
    ]);
  });

  it('lists available tools with renderer and execute flags', () => {
    const tools = getAvailableToolDebugInfo(
      {
        query: {
          description: 'Run SQL',
          execute: async () => ({}),
        },
        chart: {},
      },
      {query: () => null},
    );

    expect(tools).toEqual([
      {
        name: 'chart',
        description: undefined,
        hasExecute: false,
        hasRenderer: false,
      },
      {
        name: 'query',
        description: 'Run SQL',
        hasExecute: true,
        hasRenderer: true,
      },
    ]);
  });
});
