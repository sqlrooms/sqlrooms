import {createId} from '@paralleldrive/cuid2';
import {
  AiSliceConfig,
  AnalysisResultSchema,
  AnalysisSessionSchema,
  createDefaultAiConfig,
} from '@sqlrooms/ai-config';
import {
  createSlice,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  UIMessage,
  DefaultChatTransport,
  LanguageModel,
  ChatOnDataCallback,
  generateText,
} from 'ai';
import {
  createChatHandlers,
  createLocalChatTransportFactory,
  createRemoteChatTransportFactory,
  ToolCall,
  convertToAiSDKTools,
} from './chatTransport';
import {
  ABORT_EVENT,
  AI_DEFAULT_TEMPERATURE,
  ANALYSIS_CANCELLED,
  ANALYSIS_PENDING_ID,
  SESSION_DELETED,
  TOOL_CALL_CANCELLED,
} from './constants';
import {hasAiSettingsConfig} from './hasAiSettingsConfig';
import {OpenAssistantToolSet} from '@openassistant/utils';
import type {
  AddToolResult,
  AiChatSendMessage,
  GetProviderOptions,
} from './types';
import {
  cleanupPendingAnalysisResults,
  ToolAbortError,
  fixIncompleteToolCalls,
} from './utils';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

export type AiSliceState = {
  ai: {
    config: AiSliceConfig;
    promptSuggestionsVisible: boolean;
    /** Tracks API key errors per provider (e.g., 401/403 responses) */
    apiKeyErrors: Record<string, boolean>;
    tools: OpenAssistantToolSet;
    getProviderOptions?: GetProviderOptions;
    setConfig: (config: AiSliceConfig) => void;
    setPromptSuggestionsVisible: (visible: boolean) => void;
    /** Set API key error flag for a provider */
    setApiKeyError: (provider: string, hasError: boolean) => void;
    /** Check if there's an API key error for the current provider */
    hasApiKeyError: () => boolean;
    getAbortController: (sessionId: string) => AbortController | undefined;
    setAbortController: (
      sessionId: string,
      controller: AbortController | undefined,
    ) => void;
    setChatStop: (sessionId: string, stop: (() => void) | undefined) => void;
    getChatStop: (sessionId: string) => (() => void) | undefined;
    setChatSendMessage: (
      sessionId: string,
      sendMessage: AiChatSendMessage | undefined,
    ) => void;
    getChatSendMessage: (sessionId: string) => AiChatSendMessage | undefined;
    setAddToolResult: (
      sessionId: string,
      addToolResult: AddToolResult | undefined,
    ) => void;
    getAddToolResult: (sessionId: string) => AddToolResult | undefined;
    waitForToolResult: (
      sessionId: string,
      toolCallId: string,
      abortSignal?: AbortSignal,
    ) => Promise<void>;
    /** Map toolCallId -> sessionId for long-running tool streams (e.g. agent tools) */
    setToolCallSession: (
      toolCallId: string,
      sessionId: string | undefined,
    ) => void;
    getToolCallSession: (toolCallId: string) => string | undefined;
    setPrompt: (sessionId: string, prompt: string) => void;
    getPrompt: (sessionId: string) => string;
    setIsRunning: (sessionId: string, isRunning: boolean) => void;
    getIsRunning: (sessionId: string) => boolean;
    addAnalysisResult: (message: UIMessage) => void;
    sendPrompt: (
      prompt: string,
      options?: {
        systemInstructions?: string;
        modelProvider?: string;
        modelName?: string;
        baseUrl?: string;
        abortSignal?: AbortSignal;
        useTools?: boolean;
      },
    ) => Promise<string>;
    startAnalysis: (sessionId: string) => Promise<void>;
    cancelAnalysis: (sessionId: string) => void;
    setAiModel: (modelProvider: string, model: string) => void;
    createSession: (
      name?: string,
      modelProvider?: string,
      model?: string,
    ) => void;
    switchSession: (sessionId: string) => void;
    renameSession: (sessionId: string, name: string) => void;
    deleteSession: (sessionId: string) => void;
    setOpenSessionTabs: (tabs: string[]) => void;
    getCurrentSession: () => AnalysisSessionSchema | undefined;
    setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
    setSessionToolAdditionalData: (
      sessionId: string,
      toolCallId: string,
      additionalData: unknown,
    ) => void;
    getAnalysisResults: () => AnalysisResultSchema[] | undefined;
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    getAssistantMessageParts: (analysisResultId: string) => UIMessage['parts'];
    findToolComponent: (toolName: string) => React.ComponentType | undefined;
    getApiKeyFromSettings: () => string;
    getBaseUrlFromSettings: () => string | undefined;
    getMaxStepsFromSettings: () => number;
    getFullInstructions: () => string;
    getLocalChatTransport: (
      sessionId: string,
    ) => DefaultChatTransport<UIMessage>;
    /** Optional remote endpoint to use for chat; if empty, local transport is used */
    chatEndPoint: string;
    chatHeaders: Record<string, string>;
    getRemoteChatTransport: (
      sessionId: string,
      endpoint: string,
      headers?: Record<string, string>,
    ) => DefaultChatTransport<UIMessage>;
    onChatFinish: (args: {
      sessionId: string;
      messages: UIMessage[];
      isError?: boolean;
    }) => void;
    onChatToolCall: (args: {
      sessionId: string;
      toolCall: ToolCall;
      addToolResult?: AddToolResult;
    }) => Promise<void> | void;
    onChatData: (
      sessionId: string,
      dataPart: Parameters<ChatOnDataCallback<UIMessage>>[0],
    ) => void;
    onChatError: (sessionId: string, error: unknown) => void;
  };
};

/**
 * Configuration options for creating an AI slice
 */
export interface AiSliceOptions {
  config?: Partial<AiSliceConfig>;
  initialPrompt?: string;
  tools: OpenAssistantToolSet;
  getInstructions: () => string;
  defaultProvider?: string;
  defaultModel?: string;
  /** Provide a pre-configured model client for a provider (e.g., Azure). */
  getCustomModel?: () => LanguageModel | undefined;
  getProviderOptions?: GetProviderOptions;
  maxSteps?: number;
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string;
  /** Optional remote endpoint to use for chat; if empty, local transport is used */
  chatEndPoint?: string;
  /** Optional headers to send with remote endpoint */
  chatHeaders?: Record<string, string>;
}

export function createAiSlice(
  params: AiSliceOptions,
): StateCreator<AiSliceState> {
  const {
    initialPrompt = '',
    tools,
    getApiKey,
    getBaseUrl,
    maxSteps = 50,
    getInstructions,
    defaultProvider = 'openai',
    defaultModel = 'gpt-4.1',
    getCustomModel,
    getProviderOptions,
    chatEndPoint = '',
    chatHeaders = {},
  } = params;

  return createSlice<AiSliceState>((set, get, store) => {
    // Clean up pending analysis results from persisted config
    const cleanedConfig = params.config?.sessions
      ? {
          ...params.config,
          sessions: params.config.sessions.map((session) => {
            const cleaned = cleanupPendingAnalysisResults(session);
            const completedUiMessages = Array.isArray(cleaned.uiMessages)
              ? fixIncompleteToolCalls(
                  (cleaned.uiMessages as unknown as UIMessage[]) || [],
                )
              : [];
            return {
              ...cleaned,
              uiMessages:
                completedUiMessages as unknown as AnalysisSessionSchema['uiMessages'],
            };
          }),
        }
      : params.config;

    // Create persistent Maps (outside of immer draft)
    const pendingToolCallResolvers = new Map<
      string,
      {resolve: () => void; reject: (error: Error) => void}
    >();

    const toolCallToSessionId = new Map<string, string>();
    const sessionAbortControllers = new Map<string, AbortController>();
    const sessionChatStops = new Map<string, () => void>();
    const sessionChatSendMessages = new Map<string, AiChatSendMessage>();
    const sessionAddToolResults = new Map<string, AddToolResult>();

    // Initialize base config and ensure the initial session respects default provider/model
    const baseConfig = createDefaultAiConfig(cleanedConfig);
    if (!cleanedConfig?.sessions || cleanedConfig.sessions.length === 0) {
      const firstSession = baseConfig.sessions[0];
      if (firstSession) {
        firstSession.modelProvider = defaultProvider;
        firstSession.model = defaultModel;
        firstSession.prompt = initialPrompt;
        firstSession.isRunning = false;
      }
    }

    // Clean up openSessionTabs for sessions that no longer exist and ensure it's initialized
    const sessionIdSet = new Set(baseConfig.sessions.map((s) => s.id));
    if (baseConfig.openSessionTabs && baseConfig.openSessionTabs.length > 0) {
      baseConfig.openSessionTabs = baseConfig.openSessionTabs.filter((id) =>
        sessionIdSet.has(id),
      );
    }
    // Ensure openSessionTabs is initialized with current session if empty/missing
    if (
      !baseConfig.openSessionTabs ||
      baseConfig.openSessionTabs.length === 0
    ) {
      baseConfig.openSessionTabs = baseConfig.currentSessionId
        ? [baseConfig.currentSessionId]
        : [];
    }

    return {
      ai: {
        config: baseConfig,
        promptSuggestionsVisible: true,
        apiKeyErrors: {},
        tools,
        getProviderOptions,
        waitForToolResult: (
          sessionId: string,
          toolCallId: string,
          abortSignal?: AbortSignal,
        ) => {
          const key = `${sessionId}:${toolCallId}`;
          return new Promise<void>((resolve, reject) => {
            // Set up abort handler
            const abortHandler = () => {
              const resolver = pendingToolCallResolvers.get(key);
              if (resolver) {
                pendingToolCallResolvers.delete(key);
                resolver.reject(new Error(TOOL_CALL_CANCELLED));
              }
            };

            if (abortSignal) {
              if (abortSignal.aborted) {
                reject(new Error(TOOL_CALL_CANCELLED));
                return;
              }
              abortSignal.addEventListener(ABORT_EVENT, abortHandler, {
                once: true,
              });
            }

            // Store resolver (overwrites any existing one, which is fine for our use case)
            pendingToolCallResolvers.set(key, {
              resolve: () => {
                if (abortSignal) {
                  abortSignal.removeEventListener(ABORT_EVENT, abortHandler);
                }
                pendingToolCallResolvers.delete(key);
                resolve();
              },
              reject: (error: Error) => {
                if (abortSignal) {
                  abortSignal.removeEventListener(ABORT_EVENT, abortHandler);
                }
                pendingToolCallResolvers.delete(key);
                reject(error);
              },
            });
          });
        },

        setToolCallSession: (
          toolCallId: string,
          sessionId: string | undefined,
        ) => {
          if (!toolCallId) return;
          if (sessionId) {
            toolCallToSessionId.set(toolCallId, sessionId);
          } else {
            toolCallToSessionId.delete(toolCallId);
          }
        },
        getToolCallSession: (toolCallId: string) => {
          if (!toolCallId) return undefined;
          return toolCallToSessionId.get(toolCallId);
        },

        getAbortController: (sessionId: string) => {
          return sessionAbortControllers.get(sessionId);
        },
        setAbortController: (
          sessionId: string,
          controller: AbortController | undefined,
        ) => {
          if (controller) {
            sessionAbortControllers.set(sessionId, controller);
          } else {
            sessionAbortControllers.delete(sessionId);
          }
        },

        setChatStop: (sessionId: string, stopFn: (() => void) | undefined) => {
          if (stopFn) {
            sessionChatStops.set(sessionId, stopFn);
          } else {
            sessionChatStops.delete(sessionId);
          }
        },
        getChatStop: (sessionId: string) => {
          return sessionChatStops.get(sessionId);
        },

        setChatSendMessage: (
          sessionId: string,
          sendMessageFn: AiChatSendMessage | undefined,
        ) => {
          if (sendMessageFn) {
            sessionChatSendMessages.set(sessionId, sendMessageFn);
          } else {
            sessionChatSendMessages.delete(sessionId);
          }
        },
        getChatSendMessage: (sessionId: string) => {
          return sessionChatSendMessages.get(sessionId);
        },

        setAddToolResult: (
          sessionId: string,
          addToolResultFn: AddToolResult | undefined,
        ) => {
          if (addToolResultFn) {
            // Wrap addToolResult to intercept calls and resolve pending promises
            const wrappedAddToolResult: AddToolResult = (options) => {
              addToolResultFn(options);
              const key = `${sessionId}:${options.toolCallId}`;
              const resolver = pendingToolCallResolvers.get(key);
              if (resolver) {
                resolver.resolve();
              }
              // Tool is complete (success or error), we can drop toolCall->session mapping.
              toolCallToSessionId.delete(options.toolCallId);
            };
            sessionAddToolResults.set(sessionId, wrappedAddToolResult);
          } else {
            sessionAddToolResults.delete(sessionId);
          }
        },
        getAddToolResult: (sessionId: string) => {
          return sessionAddToolResults.get(sessionId);
        },

        setConfig: (config: AiSliceConfig) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.config = config;
            }),
          );
        },

        setPromptSuggestionsVisible: (visible: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.promptSuggestionsVisible = visible;
            }),
          );
        },

        setApiKeyError: (provider: string, hasError: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              if (hasError) {
                draft.ai.apiKeyErrors[provider] = true;
              } else {
                delete draft.ai.apiKeyErrors[provider];
              }
            }),
          );
        },

        hasApiKeyError: () => {
          const state = get();
          const currentSession = state.ai.getCurrentSession();
          const provider = currentSession?.modelProvider || defaultProvider;
          return Boolean(state.ai.apiKeyErrors[provider]);
        },

        setPrompt: (sessionId: string, prompt: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.prompt = prompt;
              }
            }),
          );
        },
        getPrompt: (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: AnalysisSessionSchema) => s.id === sessionId,
          );
          return session?.prompt || '';
        },

        setIsRunning: (sessionId: string, isRunning: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.isRunning = isRunning;
              }
            }),
          );
        },
        getIsRunning: (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: AnalysisSessionSchema) => s.id === sessionId,
          );
          return session?.isRunning || false;
        },

        /**
         * Set the AI model for the current session
         * @param model - The model to set
         */
        setAiModel: (modelProvider: string, model: string) => {
          set((state) =>
            produce(state, (draft) => {
              const currentSession = getCurrentSessionFromState(draft);
              if (currentSession) {
                currentSession.modelProvider = modelProvider;
                currentSession.model = model;
              }
            }),
          );
        },

        /**
         * Get the current active session
         */
        getCurrentSession: () => {
          const state = get();
          const {currentSessionId, sessions} = state.ai.config;
          return sessions.find((session) => session.id === currentSessionId);
        },

        /**
         * Create a new session with the given name and model settings
         */
        createSession: (
          name?: string,
          modelProvider?: string,
          model?: string,
        ) => {
          const currentSession = get().ai.getCurrentSession();
          const newSessionId = createId();

          // Generate a default name if none is provided
          let sessionName = name;
          if (!sessionName) {
            // Generate a human-readable date and time for the session name
            const now = new Date();
            const formattedDate = now.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const formattedTime = now.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            });
            sessionName = `Session ${formattedDate} at ${formattedTime}`;
          }

          set((state) =>
            produce(state, (draft) => {
              const now = Date.now();
              // Add to AI sessions with per-session state
              draft.ai.config.sessions.unshift({
                id: newSessionId,
                name: sessionName,
                modelProvider:
                  modelProvider ||
                  currentSession?.modelProvider ||
                  defaultProvider,
                model: model || currentSession?.model || defaultModel,
                analysisResults: [],
                createdAt: new Date(),
                uiMessages: [],
                toolAdditionalData: {},
                messagesRevision: 0,
                prompt: '',
                isRunning: false,
                lastOpenedAt: now,
              });
              draft.ai.config.currentSessionId = newSessionId;
              // Add new session to open tabs
              if (!draft.ai.config.openSessionTabs) {
                draft.ai.config.openSessionTabs = [];
              }
              draft.ai.config.openSessionTabs.push(newSessionId);
            }),
          );
        },

        /**
         * Switch to a different session
         */
        switchSession: (sessionId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const now = Date.now();
              draft.ai.config.currentSessionId = sessionId;
              // Ensure current session is always in openSessionTabs
              if (!draft.ai.config.openSessionTabs) {
                draft.ai.config.openSessionTabs = [];
              }
              if (!draft.ai.config.openSessionTabs.includes(sessionId)) {
                draft.ai.config.openSessionTabs.push(sessionId);
              }
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.lastOpenedAt = now;
              }
            }),
          );
        },

        /**
         * Set the list of open session tab IDs
         */
        setOpenSessionTabs: (tabs: string[]) => {
          set((state) =>
            produce(state, (draft) => {
              // Filter out any tabs for sessions that no longer exist
              const sessionIdSet = new Set(
                draft.ai.config.sessions.map((s) => s.id),
              );
              draft.ai.config.openSessionTabs = tabs.filter((id) =>
                sessionIdSet.has(id),
              );
            }),
          );
        },

        /**
         * Rename an existing session
         */
        renameSession: (sessionId: string, name: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.name = name;
              }
            }),
          );
        },

        /**
         * Delete a session and clean up its resources
         */
        deleteSession: (sessionId: string) => {
          // Clean up per-session state
          const abortController = sessionAbortControllers.get(sessionId);
          if (abortController) {
            abortController.abort(SESSION_DELETED);
          }
          sessionAbortControllers.delete(sessionId);
          sessionChatStops.delete(sessionId);
          sessionChatSendMessages.delete(sessionId);
          sessionAddToolResults.delete(sessionId);
          const now = Date.now();

          set((state) =>
            produce(state, (draft) => {
              const sessionIndex = draft.ai.config.sessions.findIndex(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (sessionIndex !== -1) {
                // Don't delete the last session
                if (draft.ai.config.sessions.length > 1) {
                  draft.ai.config.sessions.splice(sessionIndex, 1);
                  // Remove from open tabs
                  if (draft.ai.config.openSessionTabs) {
                    draft.ai.config.openSessionTabs =
                      draft.ai.config.openSessionTabs.filter(
                        (id) => id !== sessionId,
                      );
                  }
                  // If we deleted the current session, switch to another one
                  if (draft.ai.config.currentSessionId === sessionId) {
                    // Make sure there's at least one session before accessing its id
                    if (draft.ai.config.sessions.length > 0) {
                      const firstSession = draft.ai.config.sessions[0];
                      if (firstSession) {
                        draft.ai.config.currentSessionId = firstSession.id;
                        firstSession.lastOpenedAt = now;
                      }
                    }
                  }
                }
              }
            }),
          );
        },

        /**
         * Save the Ai SDK UI messages for a session
         */
        setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                // store the latest UI messages from the chat hook
                // Create a deep copy to avoid read-only property issues
                session.uiMessages = JSON.parse(JSON.stringify(uiMessages));
              }
            }),
          );
        },

        /**
         * Save additional data for a session
         */
        setSessionToolAdditionalData: (
          sessionId: string,
          toolCallId: string,
          additionalData: unknown,
        ) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s) => s.id === sessionId,
              );
              if (session) {
                if (!session.toolAdditionalData) {
                  session.toolAdditionalData = {};
                }
                session.toolAdditionalData[toolCallId] = additionalData;
              }
            }),
          );
        },

        findToolComponent: (toolName: string) => {
          return get().ai.tools[toolName]?.component as React.ComponentType;
        },

        getBaseUrlFromSettings: () => {
          // First try the getBaseUrl function if provided
          const baseUrlFromFunction = getBaseUrl?.();
          if (baseUrlFromFunction) {
            return baseUrlFromFunction;
          }

          // Fall back to settings
          const store = get();
          if (hasAiSettingsConfig(store)) {
            const currentSession = getCurrentSessionFromState(store);
            if (currentSession) {
              if (currentSession.modelProvider === 'custom') {
                const customModel = store.aiSettings.config.customModels.find(
                  (m: {modelName: string}) =>
                    m.modelName === currentSession.model,
                );
                return customModel?.baseUrl;
              }
              const provider =
                store.aiSettings.config.providers[currentSession.modelProvider];
              return provider?.baseUrl;
            }
          }
          return undefined;
        },

        getApiKeyFromSettings: () => {
          const store = get();
          const currentSession = getCurrentSessionFromState(store);
          if (currentSession) {
            // First try the getApiKey function if provided
            const apiKeyFromFunction = getApiKey?.(
              currentSession.modelProvider || 'openai',
            );
            if (apiKeyFromFunction) {
              return apiKeyFromFunction;
            }

            // Fall back to settings
            if (hasAiSettingsConfig(store)) {
              if (currentSession.modelProvider === 'custom') {
                const customModel = store.aiSettings.config.customModels.find(
                  (m: {modelName: string}) =>
                    m.modelName === currentSession.model,
                );
                return customModel?.apiKey || '';
              } else {
                const provider =
                  store.aiSettings.config.providers?.[
                    currentSession.modelProvider
                  ];
                return provider?.apiKey || '';
              }
            }
          }
          return '';
        },

        getMaxStepsFromSettings: () => {
          const store = get();
          // First try the maxSteps parameter if provided
          if (maxSteps && Number.isFinite(maxSteps) && maxSteps > 0) {
            return maxSteps;
          }

          // Fall back to settings
          if (hasAiSettingsConfig(store)) {
            const settingsMaxSteps =
              store.aiSettings.config.modelParameters.maxSteps;
            if (Number.isFinite(settingsMaxSteps) && settingsMaxSteps > 0) {
              return settingsMaxSteps;
            }
          }
          return 50;
        },

        getFullInstructions: () => {
          const store = get();

          let instructions = getInstructions();

          // Fall back to settings
          if (hasAiSettingsConfig(store)) {
            // get additional instructions from settings
            const {additionalInstruction} =
              store.aiSettings.config.modelParameters;
            if (additionalInstruction) {
              instructions = `${instructions}\n\nAdditional Instructions:\n\n${additionalInstruction}`;
            }
          }
          return instructions;
        },

        sendPrompt: async (
          prompt: string,
          options: {
            systemInstructions?: string;
            modelProvider?: string;
            modelName?: string;
            baseUrl?: string;
            useTools?: boolean;
            abortSignal?: AbortSignal;
          } = {},
        ) => {
          // One-shot generateText path with explicit abort lifecycle management
          const state = get();
          const currentSession = state.ai.getCurrentSession(); // only used when no model provider is provided
          const {
            systemInstructions,
            modelProvider,
            modelName,
            baseUrl,
            abortSignal,
            useTools = false,
          } = options;

          if (abortSignal?.aborted) {
            throw new ToolAbortError(TOOL_CALL_CANCELLED);
          }

          const provider =
            modelProvider || currentSession?.modelProvider || defaultProvider;
          const modelId = modelName || currentSession?.model || defaultModel;
          const baseURL = baseUrl ?? state.ai.getBaseUrlFromSettings() ?? '';
          const tools = state.ai.tools;

          const toolsWithoutExecute = Object.fromEntries(
            Object.entries(tools).filter(([, tool]) => !tool.execute),
          );

          const model = createOpenAICompatible({
            apiKey: state.ai.getApiKeyFromSettings(),
            name: provider,
            baseURL,
          }).chatModel(modelId);

          try {
            const response = await generateText({
              model,
              temperature: AI_DEFAULT_TEMPERATURE,
              messages: [{role: 'user', content: prompt}],
              system: systemInstructions || state.ai.getFullInstructions(),
              abortSignal: abortSignal,
              ...(useTools
                ? {tools: convertToAiSDKTools(toolsWithoutExecute)}
                : {}),
            });
            return response.text;
          } catch (error) {
            const errorName =
              typeof error === 'object' && error && 'name' in error
                ? String((error as {name?: unknown}).name)
                : '';
            if (abortSignal?.aborted || errorName === 'AbortError') {
              throw new ToolAbortError(TOOL_CALL_CANCELLED);
            }
            console.error('Error generating text:', error);
            return 'error: can not generate response';
          }
        },

        /**
         * Start the analysis for a specific session
         */
        startAnalysis: async (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: AnalysisSessionSchema) => s.id === sessionId,
          );

          if (!session) {
            console.error('Session not found:', sessionId);
            return;
          }

          const sendMessage = state.ai.getChatSendMessage(sessionId);
          if (!sendMessage) {
            console.error(
              'No sendMessage function found for session:',
              sessionId,
            );
            return;
          }

          const abortController = new AbortController();
          const promptText = session.prompt || '';

          // Store abort controller for this session
          state.ai.setAbortController(sessionId, abortController);

          set((stateToUpdate) =>
            produce(stateToUpdate, (draft) => {
              const draftSession = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (draftSession) {
                draftSession.isRunning = true;
                draftSession.prompt = '';
                draft.ai.promptSuggestionsVisible = false;

                // Remove any existing pending results
                draftSession.analysisResults =
                  draftSession.analysisResults.filter(
                    (result: AnalysisResultSchema) =>
                      result.id !== ANALYSIS_PENDING_ID,
                  );

                // Add incomplete analysis result with a temporary ID
                draftSession.analysisResults.push({
                  id: ANALYSIS_PENDING_ID,
                  prompt: promptText,
                  isCompleted: false,
                });
              }
            }),
          );

          // Send the message through the session's chat instance
          sendMessage({text: promptText});
        },

        cancelAnalysis: (sessionId: string) => {
          const state = get();
          const abortController = state.ai.getAbortController(sessionId);
          const stopFn = state.ai.getChatStop(sessionId);

          // Stop local chat streaming immediately if available
          stopFn?.();

          abortController?.abort(ANALYSIS_CANCELLED);

          set((stateToUpdate) =>
            produce(stateToUpdate, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.isRunning = false;
              }
              // Keep abort controller so handlers can check signal.aborted
              // It will be cleared by onChatFinish
            }),
          );
        },

        /**
         * Get the assistant message parts for a given analysis result ID
         * @param analysisResultId - The ID of the analysis result (user message ID)
         * @returns Array of message parts from the assistant's response
         */
        getAssistantMessageParts: (analysisResultId: string) => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) return [];

          const uiMessages = currentSession.uiMessages as UIMessage[];
          // Find the user message with analysisResultId
          const userMessageIndex = uiMessages.findIndex(
            (msg) => msg.id === analysisResultId && msg.role === 'user',
          );
          if (userMessageIndex === -1) return [];

          // Find the next assistant message after this user message
          for (let i = userMessageIndex + 1; i < uiMessages.length; i++) {
            const msg = uiMessages[i];
            if (msg?.role === 'assistant') {
              return msg.parts;
            }
            if (msg?.role === 'user') {
              // Hit next user message without finding assistant response
              break;
            }
          }
          return [];
        },

        /**
         * Delete an analysis result from a session
         * - remove the corresponding prompt-response pair from uiMessages
         * - remove the associated toolAdditionalData
         */
        deleteAnalysisResult: (sessionId: string, resultId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.analysisResults = session.analysisResults.filter(
                  (r: AnalysisResultSchema) => r.id !== resultId,
                );
                // Remove corresponding prompt-response pair from uiMessages
                const uiMessages = session.uiMessages as UIMessage[];
                const userMessageIndex = uiMessages.findIndex(
                  (msg) => msg.id === resultId && msg.role === 'user',
                );

                if (userMessageIndex !== -1) {
                  // Find the next user message (or end of array) to determine response boundary
                  let nextUserIndex = userMessageIndex + 1;
                  const toolCallIdsToDelete: Set<string> = new Set();

                  while (
                    nextUserIndex < uiMessages.length &&
                    uiMessages[nextUserIndex]?.role !== 'user'
                  ) {
                    const msg = uiMessages[nextUserIndex];
                    // Extract toolCallId from message parts
                    if (msg?.parts) {
                      for (const part of msg.parts) {
                        // Check for tool-* or dynamic-tool parts that have toolCallId
                        if (
                          'toolCallId' in part &&
                          typeof part.toolCallId === 'string'
                        ) {
                          toolCallIdsToDelete.add(part.toolCallId);
                        }
                      }
                    }
                    nextUserIndex++;
                  }

                  // Remove the user message and all assistant messages until the next user message
                  session.uiMessages.splice(
                    userMessageIndex,
                    nextUserIndex - userMessageIndex,
                  );

                  // Increment messagesRevision to force useChat reset
                  session.messagesRevision =
                    (session.messagesRevision || 0) + 1;

                  // Clean up toolAdditionalData for deleted messages
                  if (session.toolAdditionalData) {
                    // Remove data keyed by the toolCallId from the deleted messages
                    toolCallIdsToDelete.forEach((toolCallId) => {
                      if (session.toolAdditionalData![toolCallId]) {
                        delete session.toolAdditionalData![toolCallId];
                      }
                    });
                  }
                }
              }
            }),
          );
        },

        /**
         * Get analysis results for the current session by transforming UI messages
         * into structured analysis results (user prompt → AI response pairs).
         *
         * @returns Array of analysis results for the current session
         */
        getAnalysisResults: () => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) return undefined;

          return currentSession.analysisResults;
        },

        /**
         * Add an analysis result to the current session
         * - add the message to the uiMessages
         * - add the analysis result to the analysisResults
         */
        addAnalysisResult: (message: UIMessage) => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) {
            console.error('No current session found');
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              // Extract text content from message parts
              const textContent =
                message.parts
                  ?.filter((part) => part.type === 'text')
                  ?.map((part) => (part as {text: string}).text)
                  ?.join('') || '';

              draft.ai.config.sessions
                .find((s: AnalysisSessionSchema) => s.id === currentSession?.id)
                ?.analysisResults.push({
                  id: message.id,
                  prompt: textContent,
                  isCompleted: true,
                });
            }),
          );
        },

        // Chat transport configuration
        chatEndPoint,
        chatHeaders,

        getLocalChatTransport: (sessionId: string) => {
          return createLocalChatTransportFactory({
            store,
            defaultProvider: defaultProvider,
            defaultModel: defaultModel,
            getInstructions: () => store.getState().ai.getFullInstructions(),
            getCustomModel,
            sessionId,
          })();
        },

        getRemoteChatTransport: (
          sessionId: string,
          endpoint: string,
          headers?: Record<string, string>,
        ) =>
          createRemoteChatTransportFactory({
            store,
            defaultProvider,
            defaultModel,
            sessionId,
          })(endpoint, headers),

        ...createChatHandlers({store}),
      },
    };
  });
}

/**
 * Helper function to get the current session from state
 */
function getCurrentSessionFromState(
  state: AiSliceState,
): AnalysisSessionSchema | undefined {
  const {currentSessionId, sessions} = state.ai.config;
  return sessions.find((session) => session.id === currentSessionId);
}

export function useStoreWithAi<T>(selector: (state: AiSliceState) => T): T {
  return useBaseRoomStore<AiSliceState, T>((state) => selector(state));
}
