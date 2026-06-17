import type {AiSliceConfig, ChatSessionSchema} from '@sqlrooms/ai-config';
import type {UIMessage} from 'ai';
import {
  cleanupSessionForks,
  createForkedChatSessionFromMessage,
  getForkedAgentProgress,
} from '../src/chatSessionForking';

function createSession(
  overrides: Partial<ChatSessionSchema> = {},
): ChatSessionSchema {
  return {
    id: 'source-session',
    name: 'Greeting',
    modelProvider: 'openai',
    model: 'gpt-4.1',
    createdAt: new Date(100),
    uiMessages: [],
    messagesRevision: 0,
    prompt: '',
    isRunning: false,
    lastOpenedAt: 100,
    ...overrides,
  };
}

describe('chatSessionForking', () => {
  it('creates a forked session from a selected assistant message', () => {
    const sourceMessages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{type: 'text', text: 'hi'}],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{type: 'text', text: 'continue'}],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{type: 'text', text: 'done'}],
      },
      {
        id: 'user-3',
        role: 'user',
        parts: [{type: 'text', text: 'not copied'}],
      },
    ];
    const sourceSession = createSession({
      uiMessages: sourceMessages,
      draftContextItemIds: ['map-a', 'map-a'],
    });

    const fork = createForkedChatSessionFromMessage({
      sourceSession,
      args: {
        sourceSessionId: 'source-session',
        sourceMessageId: 'assistant-2',
      },
      targetSessionId: 'fork-session',
      now: 1234,
    });

    expect(fork?.forkedSession).toMatchObject({
      id: 'fork-session',
      name: 'Fork of Greeting',
      modelProvider: 'openai',
      model: 'gpt-4.1',
      messagesRevision: 0,
      prompt: '',
      draftContextItemIds: ['map-a'],
      isRunning: false,
      lastOpenedAt: 1234,
    });
    expect(fork?.forkedSession.createdAt).toEqual(new Date(1234));
    expect(fork?.forkedSession.uiMessages.map((message) => message.id)).toEqual(
      ['user-1', 'assistant-1', 'user-2', 'assistant-2'],
    );
    expect(fork?.forkOrigin).toMatchObject({
      sourceSessionId: 'source-session',
      sourceMessageId: 'assistant-2',
      sourceTurnId: 'user-2',
      sourceMessageIndex: 3,
      sourceSessionNameAtFork: 'Greeting',
      createdAt: 1234,
    });
  });

  it('rejects message-only forks from incomplete assistant turns', () => {
    const sourceMessages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'stream'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'partial',
            state: 'streaming',
          } as UIMessage['parts'][number],
        ],
      },
    ];
    const sourceSession = createSession({
      uiMessages: sourceMessages,
      isRunning: true,
    });

    expect(
      createForkedChatSessionFromMessage({
        sourceSession,
        args: {
          sourceSessionId: 'source-session',
          sourceMessageId: 'assistant-1',
        },
        targetSessionId: 'fork-session',
        now: 1234,
      }),
    ).toBeUndefined();

    expect(
      createForkedChatSessionFromMessage({
        sourceSession,
        args: {
          sourceSessionId: 'source-session',
          sourceMessageIndex: 1,
        },
        targetSessionId: 'fork-session',
        now: 1234,
      }),
    ).toBeUndefined();
  });

  it('rejects inconsistent selected messages and source turns', () => {
    const sourceMessages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'first'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{type: 'text', text: 'first answer'}],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{type: 'text', text: 'second'}],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{type: 'text', text: 'second answer'}],
      },
    ];
    const sourceSession = createSession({uiMessages: sourceMessages});

    expect(
      createForkedChatSessionFromMessage({
        sourceSession,
        args: {
          sourceSessionId: 'source-session',
          sourceTurnId: 'user-2',
          sourceMessageId: 'assistant-1',
        },
        targetSessionId: 'fork-session',
        now: 1234,
      }),
    ).toBeUndefined();

    expect(
      createForkedChatSessionFromMessage({
        sourceSession,
        args: {
          sourceSessionId: 'source-session',
          sourceTurnId: 'user-1',
          sourceMessageId: 'user-1',
        },
        targetSessionId: 'fork-session',
        now: 1234,
      }),
    ).toBeUndefined();
  });

  it('copies run context only when draft context is absent', () => {
    const sourceMessages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'use context'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{type: 'text', text: 'done'}],
      },
    ];
    const runContext = {
      items: [
        {
          kind: 'artifact',
          id: 'map-a',
          type: 'map',
          title: 'Map A',
        },
      ],
      capturedAt: 123,
    } as const;

    const forkWithRunContext = createForkedChatSessionFromMessage({
      sourceSession: createSession({
        uiMessages: sourceMessages,
        runContext,
      }),
      args: {
        sourceSessionId: 'source-session',
        sourceMessageId: 'assistant-1',
      },
      targetSessionId: 'fork-session',
      now: 1234,
    });

    expect(forkWithRunContext?.forkedSession.runContext).toEqual(runContext);
    expect(forkWithRunContext?.forkedSession.runContext).not.toBe(runContext);

    const forkWithDraftContext = createForkedChatSessionFromMessage({
      sourceSession: createSession({
        uiMessages: sourceMessages,
        runContext,
        draftContextItemIds: ['map-a'],
      }),
      args: {
        sourceSessionId: 'source-session',
        sourceMessageId: 'assistant-1',
      },
      targetSessionId: 'fork-session',
      now: 1234,
    });

    expect(forkWithDraftContext?.forkedSession.draftContextItemIds).toEqual([
      'map-a',
    ]);
    expect(forkWithDraftContext?.forkedSession.runContext).toBeUndefined();
  });

  it('filters forked agent progress to copied tool calls', () => {
    const sourceSession = createSession({
      agentProgress: {
        'copied-tool': [
          {
            toolCallId: 'nested-tool',
            toolName: 'query',
            state: 'success',
          },
        ],
        'omitted-tool': [
          {
            toolCallId: 'other-nested-tool',
            toolName: 'query',
            state: 'success',
          },
        ],
      },
    });
    const targetMessages: ChatSessionSchema['uiMessages'] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'copied-tool',
            state: 'output-available',
            input: {},
            output: {},
          } as UIMessage['parts'][number],
        ],
      },
    ];

    const agentProgress = getForkedAgentProgress({
      sourceSession,
      targetMessages,
    });

    expect(agentProgress).toEqual({
      'copied-tool': [
        {
          toolCallId: 'nested-tool',
          toolName: 'query',
          state: 'success',
        },
      ],
    });
    expect(agentProgress).not.toBe(sourceSession.agentProgress);
    expect(agentProgress?.['copied-tool']).not.toBe(
      sourceSession.agentProgress?.['copied-tool'],
    );
  });

  it('removes fork origins whose target sessions no longer exist', () => {
    const config = {
      currentSessionId: 'source-session',
      sessions: [
        createSession(),
        createSession({
          id: 'fork-session',
          name: 'Fork of Greeting',
        }),
      ],
      sessionForks: {
        'fork-session': {
          sourceSessionId: 'source-session',
          sourceMessageId: 'assistant-1',
          sourceTurnId: 'user-1',
          sourceMessageIndex: 1,
          sourceSessionNameAtFork: 'Greeting',
          createdAt: 1234,
        },
        'deleted-fork-session': {
          sourceSessionId: 'source-session',
          sourceMessageId: 'assistant-2',
          sourceTurnId: 'user-2',
          sourceMessageIndex: 3,
          sourceSessionNameAtFork: 'Greeting',
          createdAt: 5678,
        },
      },
    } satisfies AiSliceConfig;

    expect(cleanupSessionForks(config).sessionForks).toEqual({
      'fork-session': config.sessionForks['fork-session'],
    });
  });
});
