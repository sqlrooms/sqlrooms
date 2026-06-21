import {
  AiSessionForkOrigin,
  AiSettingsSliceConfig,
  setAiRunContextPrimaryItem,
} from '@sqlrooms/ai-config';
import type {AiRunContext, AiSliceConfig} from '@sqlrooms/ai-config';
import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {createStore} from 'zustand';
import {AiSliceState, createAiSlice} from '../src/AiSlice';
import {withRunContextTools} from '../src/chatTransport';
import {
  CHAT_REQUEST_ERROR_PART_TYPE,
  getChatRequestErrorMessage,
} from '../src/chatTurns';
import {sanitizeMessagesForLLM} from '../src/utils';

type TestStoreState = AiSliceState & {
  aiSettings: {
    config: AiSettingsSliceConfig;
  };
};

function createTestStore(options?: {
  getRunContext?: (sessionId: string) => AiRunContext | undefined;
}) {
  const now = Date.now();
  const settingsConfig: AiSettingsSliceConfig = {
    providers: {
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'openai-key',
        models: [{modelName: 'shared-model'}],
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'anthropic-key',
        models: [{modelName: 'shared-model'}],
      },
    },
    customModels: [],
    modelParameters: {
      maxSteps: 50,
      additionalInstruction: '',
    },
  };

  return createStore<TestStoreState>((set, get, store) => ({
    ...createAiSlice({
      tools: {} as any,
      getInstructions: () => 'test instructions',
      getRunContext: options?.getRunContext,
      formatRunContextInstructions: ({runContext}) => {
        const mainItem = runContext.items[0];
        return mainItem ? `Context: ${mainItem.type} ${mainItem.title}` : '';
      },
      defaultProvider: 'openai',
      defaultModel: 'shared-model',
      config: {
        currentSessionId: 'session-1',
        openSessionTabs: ['session-1'],
        sessions: [
          {
            id: 'session-1',
            name: 'Session 1',
            modelProvider: 'openai',
            model: 'shared-model',
            createdAt: new Date(now),
            uiMessages: [],
            messagesRevision: 0,
            prompt: '',
            isRunning: false,
            lastOpenedAt: now,
          },
        ],
      },
    })(set, get, store),
    aiSettings: {
      config: settingsConfig,
    },
  }));
}

describe('AiSlice model selection', () => {
  it('persists chat request errors when the failed prompt has not synced to the store yet', () => {
    const store = createTestStore();
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'hi'}],
    };

    store
      .getState()
      .ai.onChatError('session-1', new TypeError('Failed to fetch'), [
        userMessage,
      ]);

    const session = store.getState().ai.config.sessions[0];
    const messages = session?.uiMessages as UIMessage[];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'hi'}],
    });
    expect(getChatRequestErrorMessage(messages[0])).toEqual({
      error: 'Failed to fetch',
    });
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      parts: [
        {
          type: CHAT_REQUEST_ERROR_PART_TYPE,
          data: {error: 'Failed to fetch'},
        },
      ],
    });
    expect(session?.isRunning).toBe(false);
    expect(session?.messagesRevision).toBe(1);

    store.getState().ai.setSessionUiMessages('session-1', [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hi'}],
      },
    ]);

    const messagesAfterStaleSync = store.getState().ai.config.sessions[0]
      ?.uiMessages as UIMessage[];
    expect(messagesAfterStaleSync).toHaveLength(2);
    expect(getChatRequestErrorMessage(messagesAfterStaleSync[0])).toEqual({
      error: 'Failed to fetch',
    });
    expect(messagesAfterStaleSync[1]?.parts[0]).toMatchObject({
      type: CHAT_REQUEST_ERROR_PART_TYPE,
      data: {error: 'Failed to fetch'},
    });
  });

  it('uses fallback chat messages when the store has an older same-length snapshot', () => {
    const store = createTestStore();
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'hi'}],
    };
    const staleAssistantMessage: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{type: 'text', text: 'old'}],
    };
    const freshAssistantMessage: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{type: 'text', text: 'new'}],
    };

    store.getState().ai.setSessionUiMessages('session-1', [
      userMessage,
      staleAssistantMessage,
    ]);

    store
      .getState()
      .ai.onChatError('session-1', new TypeError('Failed to fetch'), [
        userMessage,
        freshAssistantMessage,
      ]);

    const session = store.getState().ai.config.sessions[0];
    const messages = session?.uiMessages as UIMessage[];
    expect(messages).toHaveLength(3);
    expect(messages[1]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      parts: [{type: 'text', text: 'new'}],
    });
    expect(getChatRequestErrorMessage(messages[0])).toEqual({
      error: 'Failed to fetch',
    });
  });

  it('does not replay chat error marker messages to the model', () => {
    const messages = sanitizeMessagesForLLM([
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hi'}],
      },
      {
        id: 'assistant-error',
        role: 'assistant',
        parts: [
          {
            type: CHAT_REQUEST_ERROR_PART_TYPE,
            data: {error: 'Failed to fetch'},
          },
        ],
      },
    ]);

    expect(messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hi'}],
      },
    ]);
  });

  it('does not keep a phantom current session when initialized with no sessions', () => {
    const store = createStore<AiSliceState>((set, get, store) =>
      createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test instructions',
        defaultProvider: 'openai',
        defaultModel: 'shared-model',
        config: {
          sessions: [],
        },
      })(set, get, store),
    );

    expect(store.getState().ai.config.currentSessionId).toBeUndefined();
    expect(store.getState().ai.config.openSessionTabs).toEqual([]);
    expect(store.getState().ai.getCurrentSession()).toBeUndefined();
  });

  it('honors custom defaults when initialized without persisted config', () => {
    const store = createStore<AiSliceState>((set, get, store) =>
      createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test instructions',
        defaultProvider: 'anthropic',
        defaultModel: 'claude-test',
        initialPrompt: 'start here',
      })(set, get, store),
    );

    expect(store.getState().ai.getCurrentSession()).toMatchObject({
      modelProvider: 'anthropic',
      model: 'claude-test',
      prompt: 'start here',
    });
  });

  it('opens the repaired current session when initialized with a stale current session id', () => {
    const now = Date.now();
    const store = createStore<AiSliceState>((set, get, store) =>
      createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test instructions',
        defaultProvider: 'openai',
        defaultModel: 'shared-model',
        config: {
          currentSessionId: 'missing-session',
          openSessionTabs: ['session-2'],
          sessions: [
            {
              id: 'session-1',
              name: 'Session 1',
              modelProvider: 'openai',
              model: 'shared-model',
              createdAt: new Date(now),
              uiMessages: [],
              messagesRevision: 0,
              prompt: '',
              isRunning: false,
              lastOpenedAt: now,
            },
            {
              id: 'session-2',
              name: 'Session 2',
              modelProvider: 'openai',
              model: 'shared-model',
              createdAt: new Date(now),
              uiMessages: [],
              messagesRevision: 0,
              prompt: '',
              isRunning: false,
              lastOpenedAt: now,
            },
          ],
        },
      })(set, get, store),
    );

    expect(store.getState().ai.config.currentSessionId).toBe('session-1');
    expect(store.getState().ai.config.openSessionTabs).toEqual([
      'session-1',
      'session-2',
    ]);
  });

  it('allows deleting the last session', () => {
    const store = createTestStore();

    store.getState().ai.deleteSession('session-1');

    expect(store.getState().ai.config.sessions).toEqual([]);
    expect(store.getState().ai.config.currentSessionId).toBeUndefined();
    expect(store.getState().ai.config.openSessionTabs).toEqual([]);
    expect(store.getState().ai.getCurrentSession()).toBeUndefined();
  });

  it('returns stable derived analysis results for unchanged UI messages', () => {
    const store = createTestStore();
    const messages: UIMessage[] = [
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
    ];

    expect(
      store.getState().ai.setSessionUiMessages('session-1', messages),
    ).toBe(true);

    const first = store.getState().ai.getAnalysisResults();
    const second = store.getState().ai.getAnalysisResults();

    expect(second).toBe(first);
  });

  it('validates fork source message indexes as non-negative integers', () => {
    const baseOrigin = {
      sourceSessionId: 'source-session',
      sourceSessionNameAtFork: 'Source',
      createdAt: Date.now(),
    };

    expect(
      AiSessionForkOrigin.safeParse({
        ...baseOrigin,
        sourceMessageIndex: 0,
      }).success,
    ).toBe(true);
    expect(
      AiSessionForkOrigin.safeParse({
        ...baseOrigin,
        sourceMessageIndex: -1,
      }).success,
    ).toBe(false);
    expect(
      AiSessionForkOrigin.safeParse({
        ...baseOrigin,
        sourceMessageIndex: 1.5,
      }).success,
    ).toBe(false);
  });

  it('normalizes restored config passed through setConfig', () => {
    const store = createTestStore();
    const config: AiSliceConfig = {
      currentSessionId: 'session-2',
      openSessionTabs: ['session-2'],
      sessionForks: {
        'deleted-session': {
          sourceSessionId: 'session-1',
          sourceSessionNameAtFork: 'Deleted target',
          createdAt: Date.now(),
        },
      },
      sessions: [
        {
          id: 'session-2',
          name: 'Restored session',
          modelProvider: 'openai',
          model: 'shared-model',
          createdAt: new Date(),
          uiMessages: [
            {
              id: 'assistant-1',
              role: 'assistant',
              parts: [
                {
                  type: 'tool-query',
                  toolCallId: 'tool-1',
                  state: 'input-streaming',
                  input: {sqlQuery: 'SELECT'},
                },
              ],
            },
          ],
          messagesRevision: 0,
          prompt: '',
          isRunning: true,
          lastOpenedAt: Date.now(),
        },
      ],
    };

    store.getState().ai.setConfig(config);

    const session = store.getState().ai.getCurrentSession();
    const part = session?.uiMessages[0]?.parts[0] as
      | Record<string, unknown>
      | undefined;
    expect(session?.isRunning).toBe(false);
    expect(part?.state).toBe('output-error');
    expect(store.getState().ai.config.sessionForks).toEqual({});
  });

  it('forks a session through the selected assistant message', () => {
    const store = createTestStore();
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
      {
        id: 'user-3',
        role: 'user',
        parts: [{type: 'text', text: 'later'}],
      },
    ];

    store.getState().ai.setSessionUiMessages('session-1', sourceMessages);
    store
      .getState()
      .ai.setSessionDraftContextItemIds('session-1', ['map-a', 'map-a']);

    const forkedSessionId = store.getState().ai.forkSessionFromMessage({
      sourceSessionId: 'session-1',
      sourceTurnId: 'user-2',
      sourceMessageId: 'assistant-2',
    });

    expect(forkedSessionId).toBeDefined();
    expect(store.getState().ai.config.currentSessionId).toBe(forkedSessionId);

    const sourceSession = store
      .getState()
      .ai.config.sessions.find((session) => session.id === 'session-1');
    const forkedSession = store.getState().ai.getCurrentSession();

    expect(sourceSession?.uiMessages.map((message) => message.id)).toEqual([
      'user-1',
      'assistant-1',
      'user-2',
      'assistant-2',
      'user-3',
    ]);
    expect(forkedSession?.uiMessages.map((message) => message.id)).toEqual([
      'user-1',
      'assistant-1',
      'user-2',
      'assistant-2',
    ]);
    expect(forkedSession?.modelProvider).toBe('openai');
    expect(forkedSession?.model).toBe('shared-model');
    expect(forkedSession?.draftContextItemIds).toEqual(['map-a']);
    expect(
      store.getState().ai.getSessionForkOrigin(forkedSessionId!),
    ).toMatchObject({
      sourceSessionId: 'session-1',
      sourceMessageId: 'assistant-2',
      sourceTurnId: 'user-2',
      sourceMessageIndex: 3,
      sourceSessionNameAtFork: 'Session 1',
    });
  });

  it('rejects fork metadata when the selected message is not an assistant message in the selected turn', () => {
    const store = createTestStore();
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
    store.getState().ai.setSessionUiMessages('session-1', sourceMessages);
    const initialSessions = store.getState().ai.config.sessions;
    const initialCurrentSessionId = store.getState().ai.config.currentSessionId;

    expect(
      store.getState().ai.forkSessionFromMessage({
        sourceSessionId: 'session-1',
        sourceTurnId: 'user-2',
        sourceMessageId: 'assistant-1',
      }),
    ).toBeUndefined();
    expect(store.getState().ai.config.sessions).toBe(initialSessions);
    expect(store.getState().ai.config.currentSessionId).toBe(
      initialCurrentSessionId,
    );

    expect(
      store.getState().ai.forkSessionFromMessage({
        sourceSessionId: 'session-1',
        sourceTurnId: 'user-1',
        sourceMessageId: 'user-1',
      }),
    ).toBeUndefined();
    expect(store.getState().ai.config.sessions).toBe(initialSessions);
    expect(store.getState().ai.config.currentSessionId).toBe(
      initialCurrentSessionId,
    );
    expect(store.getState().ai.config.sessionForks).toEqual({});
  });

  it('rejects message-only forks from incomplete assistant turns', () => {
    const store = createTestStore();
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
    store.getState().ai.setSessionUiMessages('session-1', sourceMessages);
    store.getState().ai.setIsRunning('session-1', true);
    const initialSessions = store.getState().ai.config.sessions;
    const initialCurrentSessionId = store.getState().ai.config.currentSessionId;

    expect(
      store.getState().ai.forkSessionFromMessage({
        sourceSessionId: 'session-1',
        sourceMessageId: 'assistant-1',
      }),
    ).toBeUndefined();
    expect(store.getState().ai.config.sessions).toBe(initialSessions);
    expect(store.getState().ai.config.currentSessionId).toBe(
      initialCurrentSessionId,
    );

    expect(
      store.getState().ai.forkSessionFromMessage({
        sourceSessionId: 'session-1',
        sourceMessageIndex: 1,
      }),
    ).toBeUndefined();
    expect(store.getState().ai.config.sessions).toBe(initialSessions);
    expect(store.getState().ai.config.currentSessionId).toBe(
      initialCurrentSessionId,
    );
    expect(store.getState().ai.config.sessionForks).toEqual({});
  });

  it('copies run context and matching agent progress into forked sessions', () => {
    const store = createTestStore();
    const sourceMessages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'use a tool'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent-run',
            toolCallId: 'agent-tool-1',
            state: 'output-available',
            input: {},
            output: {},
          } as UIMessage['parts'][number],
        ],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{type: 'text', text: 'later'}],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent-run',
            toolCallId: 'agent-tool-2',
            state: 'output-available',
            input: {},
            output: {},
          } as UIMessage['parts'][number],
        ],
      },
    ];
    const runContext: AiRunContext = {
      items: [
        {
          kind: 'artifact',
          id: 'map-a',
          type: 'map',
          title: 'Map A',
        },
      ],
      capturedAt: 123,
    };

    store.getState().ai.setSessionUiMessages('session-1', sourceMessages);
    store.getState().ai.setSessionRunContext('session-1', runContext);
    const config = store.getState().ai.config;
    store.getState().ai.setConfig({
      ...config,
      sessions: config.sessions.map((session) =>
        session.id === 'session-1'
          ? {
              ...session,
              agentProgress: {
                'agent-tool-1': [
                  {
                    toolCallId: 'child-tool',
                    toolName: 'child',
                    state: 'success',
                  },
                ],
                'agent-tool-2': [
                  {
                    toolCallId: 'later-child-tool',
                    toolName: 'later-child',
                    state: 'success',
                  },
                ],
              },
            }
          : session,
      ),
    });

    const forkedSessionId = store.getState().ai.forkSessionFromMessage({
      sourceSessionId: 'session-1',
      sourceTurnId: 'user-1',
      sourceMessageId: 'assistant-1',
    });

    const forkedSession = store.getState().ai.getCurrentSession();
    expect(forkedSessionId).toBeDefined();
    expect(forkedSession?.runContext).toEqual(runContext);
    expect(forkedSession?.agentProgress).toEqual({
      'agent-tool-1': [
        {
          toolCallId: 'child-tool',
          toolName: 'child',
          state: 'success',
        },
      ],
    });
  });

  it('removes fork metadata when the fork target session is deleted', () => {
    const store = createTestStore();
    store.getState().ai.setSessionUiMessages('session-1', [
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
    ]);
    const forkedSessionId = store.getState().ai.forkSessionFromMessage({
      sourceSessionId: 'session-1',
      sourceTurnId: 'user-1',
      sourceMessageId: 'assistant-1',
    });

    expect(forkedSessionId).toBeDefined();
    store.getState().ai.deleteSession(forkedSessionId!);

    expect(store.getState().ai.config.sessionForks[forkedSessionId!]).toBe(
      undefined,
    );
  });

  it('appends legacy addAnalysisResult messages to the current session', () => {
    const store = createTestStore();
    const message: UIMessage = {
      id: 'user-legacy',
      role: 'user',
      parts: [{type: 'text', text: 'hello'}],
    };

    store.getState().ai.addAnalysisResult(message);

    expect(store.getState().ai.getCurrentSession()?.uiMessages).toEqual([
      message,
    ]);
  });

  it('uses the first available model when creating a session with no valid default', () => {
    const store = createStore<AiSliceState>((set, get, store) =>
      createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test instructions',
        defaultProvider: 'openai',
        defaultModel: 'missing-model',
        getAvailableModels: () => [
          {provider: 'anthropic', value: 'claude-sonnet-4.5'},
        ],
        config: {
          sessions: [],
        },
      })(set, get, store),
    );

    store.getState().ai.createSession();

    const session = store.getState().ai.getCurrentSession();
    expect(session?.modelProvider).toBe('anthropic');
    expect(session?.model).toBe('claude-sonnet-4.5');
  });

  it('switches provider without ambiguity when model names are identical', () => {
    const store = createTestStore();

    store.getState().ai.setAiModel('anthropic', 'shared-model');
    const currentSession = store.getState().ai.getCurrentSession();

    expect(currentSession?.modelProvider).toBe('anthropic');
    expect(currentSession?.model).toBe('shared-model');
  });

  it('resolves API key and base URL using provider + model pair', () => {
    const store = createTestStore();

    expect(store.getState().ai.getApiKeyFromSettings()).toBe('openai-key');
    expect(store.getState().ai.getBaseUrlFromSettings()).toBe(
      'https://api.openai.com/v1',
    );

    store.getState().ai.setAiModel('anthropic', 'shared-model');

    expect(store.getState().ai.getApiKeyFromSettings()).toBe('anthropic-key');
    expect(store.getState().ai.getBaseUrlFromSettings()).toBe(
      'https://api.anthropic.com',
    );
  });

  it('inherits current provider and model when creating a new session', () => {
    const store = createTestStore();

    store.getState().ai.setAiModel('anthropic', 'shared-model');
    const previousSessionId = store.getState().ai.config.currentSessionId;

    store.getState().ai.createSession();
    const currentSession = store.getState().ai.getCurrentSession();

    expect(currentSession).toBeDefined();
    expect(currentSession?.id).not.toBe(previousSessionId);
    expect(currentSession?.modelProvider).toBe('anthropic');
    expect(currentSession?.model).toBe('shared-model');
  });

  it('keeps draft context item IDs isolated per session', () => {
    const store = createTestStore();

    store.getState().ai.setSessionDraftContextItemIds('session-1', ['map-a']);
    store.getState().ai.createSession('Session 2');
    const session2Id = store.getState().ai.getCurrentSession()?.id;

    expect(session2Id).toBeDefined();
    store.getState().ai.setSessionDraftContextItemIds(session2Id!, ['map-b']);

    expect(
      store.getState().ai.getSessionDraftContextItemIds('session-1'),
    ).toEqual(['map-a']);
    expect(
      store.getState().ai.getSessionDraftContextItemIds(session2Id!),
    ).toEqual(['map-b']);

    store.getState().ai.switchSession('session-1');
    expect(
      store
        .getState()
        .ai.getSessionDraftContextItemIds(
          store.getState().ai.getCurrentSession()!.id,
        ),
    ).toEqual(['map-a']);
  });

  it('captures run context once when starting analysis', async () => {
    const contextA: AiRunContext = {
      items: [
        {
          kind: 'artifact',
          id: 'map-a',
          type: 'map',
          title: 'Map A',
        },
      ],
      capturedAt: 1,
    };
    const contextB: AiRunContext = {
      items: [
        {
          kind: 'artifact',
          id: 'map-b',
          type: 'map',
          title: 'Map B',
        },
      ],
      capturedAt: 2,
    };
    let activeContext = contextA;
    const store = createTestStore({
      getRunContext: () => activeContext,
    });
    const sendMessage = jest.fn();

    store.getState().ai.setChatSendMessage('session-1', sendMessage);
    store.getState().ai.setPrompt('session-1', 'hello');
    await store.getState().ai.startAnalysis('session-1');
    activeContext = contextB;

    const session = store.getState().ai.config.sessions[0];
    expect(session?.runContext).toEqual(contextA);
    expect(store.getState().ai.getFullInstructions('session-1')).toContain(
      'Map A',
    );
    expect(store.getState().ai.getFullInstructions('session-1')).not.toContain(
      'Map B',
    );
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello'});
  });

  it('clears draft context after capturing it for a run', async () => {
    const store = createTestStore({
      getRunContext: (sessionId) => {
        const draftIds = store
          .getState()
          .ai.getSessionDraftContextItemIds(sessionId);
        if (!draftIds || draftIds.length === 0) {
          return undefined;
        }
        return {
          items: draftIds.map((id) => ({
            kind: 'artifact',
            id,
            type: 'map',
            title: id,
          })),
          capturedAt: 1,
        };
      },
    });
    const sendMessage = jest.fn();

    store.getState().ai.setChatSendMessage('session-1', sendMessage);
    store.getState().ai.setSessionDraftContextItemIds('session-1', ['map-a']);
    store.getState().ai.setPrompt('session-1', 'hello');
    await store.getState().ai.startAnalysis('session-1');

    const session = store.getState().ai.config.sessions[0];
    expect(session?.runContext?.items.map((item) => item.id)).toEqual([
      'map-a',
    ]);
    expect(session?.draftContextItemIds).toBeUndefined();
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello'});
  });

  it('captures draft context for the target session when another session is current', async () => {
    const store = createTestStore({
      getRunContext: (sessionId) => {
        const draftIds = store
          .getState()
          .ai.getSessionDraftContextItemIds(sessionId);
        if (!draftIds || draftIds.length === 0) {
          return undefined;
        }
        return {
          items: draftIds.map((id) => ({
            kind: 'artifact',
            id,
            type: 'map',
            title: id,
          })),
          capturedAt: 1,
        };
      },
    });
    const sendMessage = jest.fn();

    store.getState().ai.createSession('Session 2');
    const currentSessionId = store.getState().ai.getCurrentSession()?.id;
    expect(currentSessionId).toBeDefined();
    store
      .getState()
      .ai.setSessionDraftContextItemIds(currentSessionId!, ['map-current']);

    store.getState().ai.setChatSendMessage('session-1', sendMessage);
    store
      .getState()
      .ai.setSessionDraftContextItemIds('session-1', ['map-target']);
    store.getState().ai.setPrompt('session-1', 'hello');
    await store.getState().ai.startAnalysis('session-1');

    const targetSession = store
      .getState()
      .ai.config.sessions.find((session) => session.id === 'session-1');
    const currentSession = store
      .getState()
      .ai.config.sessions.find((session) => session.id === currentSessionId);
    expect(targetSession?.runContext?.items.map((item) => item.id)).toEqual([
      'map-target',
    ]);
    expect(targetSession?.draftContextItemIds).toBeUndefined();
    expect(currentSession?.draftContextItemIds).toEqual(['map-current']);
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello'});
  });

  it('keeps wrapped tool run context mutable across tool calls', async () => {
    let runContext: AiRunContext | undefined = {
      items: [
        {
          kind: 'artifact',
          id: 'doc-1',
          type: 'document',
          title: 'Doc',
        },
      ],
      primaryItemId: 'doc-1',
      capturedAt: 1,
    };
    const setSessionRunContext = jest.fn(
      (_sessionId: string, nextContext: AiRunContext | undefined) => {
        runContext = nextContext;
      },
    );

    const tools = withRunContextTools(
      {
        set_primary: {
          execute: async (_input: unknown, context: any) => {
            context.setPrimaryRunContextItem({
              kind: 'artifact',
              id: 'dashboard-1',
              type: 'dashboard',
              title: 'Dashboard',
            });
            return {success: true};
          },
        },
        read_context: {
          execute: async (_input: unknown, context: any) => ({
            aiRunContextPrimaryItemId: context.aiRunContext?.primaryItemId,
            liveRunContextPrimaryItemId:
              context.getAiRunContext()?.primaryItemId,
          }),
        },
      } as any,
      {
        sessionId: 'session-1',
        aiRunContext: runContext,
        getAiRunContext: () => runContext,
        setAiRunContext: (nextContext) =>
          setSessionRunContext('session-1', nextContext),
        setPrimaryRunContextItem: (item) =>
          setSessionRunContext(
            'session-1',
            setAiRunContextPrimaryItem(runContext, item),
          ),
        state: {
          ai: {
            setToolCallSession: jest.fn(),
          },
        } as any,
      },
    );

    await tools.set_primary?.execute?.({}, {});
    const result = (await tools.read_context?.execute?.({}, {})) as {
      aiRunContextPrimaryItemId?: string;
      liveRunContextPrimaryItemId?: string;
    };

    expect(result.aiRunContextPrimaryItemId).toBe('dashboard-1');
    expect(result.liveRunContextPrimaryItemId).toBe('dashboard-1');
    expect(setSessionRunContext).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({primaryItemId: 'dashboard-1'}),
    );
  });
});
