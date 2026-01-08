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
  completeIncompleteToolCalls,
} from './chatTransport';
import {AI_DEFAULT_TEMPERATURE} from './constants';
import {hasAiSettingsConfig} from './hasAiSettingsConfig';
import {OpenAssistantToolSet} from '@openassistant/utils';
import type {GetProviderOptions} from './types';
import {AddToolResult} from './types';
import {cleanupPendingAnalysisResults} from './utils';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

// Custom type for onChatToolCall that includes addToolResult
type ExtendedChatOnToolCallCallback = (args: {
  toolCall: ToolCall;
  addToolResult?: AddToolResult;
}) => Promise<void> | void;

export type AiSliceState = {
  ai: {
    config: AiSliceConfig;
    promptSuggestionsVisible: boolean;
    tools: OpenAssistantToolSet;
    getProviderOptions?: GetProviderOptions;
    setConfig: (config: AiSliceConfig) => void;
    setPromptSuggestionsVisible: (visible: boolean) => void;
    /** Get abort controller for a specific session */
    getSessionAbortController: (
      sessionId: string,
    ) => AbortController | undefined;
    /** Set abort controller for a specific session */
    setSessionAbortController: (
      sessionId: string,
      controller: AbortController | undefined,
    ) => void;
    /** Register/replace the chat stop function for a specific session */
    setSessionChatStop: (
      sessionId: string,
      stop: (() => void) | undefined,
    ) => void;
    /** Get stop function for a specific session */
    getSessionChatStop: (sessionId: string) => (() => void) | undefined;
    /** Register/replace the chat sendMessage function for a specific session */
    setSessionChatSendMessage: (
      sessionId: string,
      sendMessage: ((message: {text: string}) => void) | undefined,
    ) => void;
    /** Get sendMessage function for a specific session */
    getSessionChatSendMessage: (
      sessionId: string,
    ) => ((message: {text: string}) => void) | undefined;
    /** Register/replace the addToolResult function for a specific session */
    setSessionAddToolResult: (
      sessionId: string,
      addToolResult: AddToolResult | undefined,
    ) => void;
    /** Get addToolResult function for a specific session */
    getSessionAddToolResult: (sessionId: string) => AddToolResult | undefined;
    /** Wait for a tool result to be added by UI component */
    waitForToolResult: (
      toolCallId: string,
      abortSignal?: AbortSignal,
    ) => Promise<void>;
    /** Set analysis prompt for a specific session */
    setSessionAnalysisPrompt: (sessionId: string, prompt: string) => void;
    /** Get analysis prompt for a specific session */
    getSessionAnalysisPrompt: (sessionId: string) => string;
    /** Set analysis running state for a specific session */
    setSessionIsRunningAnalysis: (
      sessionId: string,
      isRunning: boolean,
    ) => void;
    /** Get analysis running state for a specific session */
    getSessionIsRunningAnalysis: (sessionId: string) => boolean;
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
    // Chat transport for useChat hook
    getLocalChatTransport: () => DefaultChatTransport<UIMessage>;
    /** Optional remote endpoint to use for chat; if empty, local transport is used */
    chatEndPoint: string;
    chatHeaders: Record<string, string>;
    getRemoteChatTransport: (
      endpoint: string,
      headers?: Record<string, string>,
    ) => DefaultChatTransport<UIMessage>;
    onChatToolCall: ExtendedChatOnToolCallCallback;
    onChatData: ChatOnDataCallback<UIMessage>;
    onChatFinish: (args: {
      message: UIMessage;
      messages: UIMessage[];
      isError?: boolean;
    }) => void;
    onChatError: (error: unknown) => void;
  };
};

/**
 * Configuration options for creating an AI slice
 */
export interface AiSliceOptions {
  config?: Partial<AiSliceConfig>;
  /** Initial prompt to display in the analysis input */
  initialAnalysisPrompt?: string;
  /** Tools to add to the AI assistant */
  tools: OpenAssistantToolSet;

  /**
   * Function to get custom instructions for the AI assistant
   * @returns The instructions string to use
   */
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
    initialAnalysisPrompt = '',
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
              ? completeIncompleteToolCalls(
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

    // Per-session chat state Maps
    const sessionAbortControllers = new Map<string, AbortController>();
    const sessionChatStops = new Map<string, () => void>();
    const sessionChatSendMessages = new Map<
      string,
      (message: {text: string}) => void
    >();
    const sessionAddToolResults = new Map<string, AddToolResult>();

    // Initialize base config and ensure the initial session respects default provider/model
    const baseConfig = createDefaultAiConfig(cleanedConfig);
    if (!cleanedConfig?.sessions || cleanedConfig.sessions.length === 0) {
      const firstSession = baseConfig.sessions[0];
      if (firstSession) {
        firstSession.modelProvider = defaultProvider;
        firstSession.model = defaultModel;
        // Initialize per-session state
        firstSession.analysisPrompt = initialAnalysisPrompt;
        firstSession.isRunningAnalysis = false;
      }
    }

    return {
      ai: {
        config: baseConfig,
        promptSuggestionsVisible: true,
        tools,
        getProviderOptions,
        waitForToolResult: (toolCallId: string, abortSignal?: AbortSignal) => {
          return new Promise<void>((resolve, reject) => {
            // Set up abort handler
            const abortHandler = () => {
              const resolver = pendingToolCallResolvers.get(toolCallId);
              if (resolver) {
                pendingToolCallResolvers.delete(toolCallId);
                resolver.reject(new Error('Tool call cancelled by user'));
              }
            };

            if (abortSignal) {
              if (abortSignal.aborted) {
                reject(new Error('Tool call cancelled by user'));
                return;
              }
              abortSignal.addEventListener('abort', abortHandler, {once: true});
            }

            // Store resolver (overwrites any existing one, which is fine for our use case)
            pendingToolCallResolvers.set(toolCallId, {
              resolve: () => {
                if (abortSignal) {
                  abortSignal.removeEventListener('abort', abortHandler);
                }
                pendingToolCallResolvers.delete(toolCallId);
                resolve();
              },
              reject: (error: Error) => {
                if (abortSignal) {
                  abortSignal.removeEventListener('abort', abortHandler);
                }
                pendingToolCallResolvers.delete(toolCallId);
                reject(error);
              },
            });
          });
        },

        // Per-session abort controller management
        getSessionAbortController: (sessionId: string) => {
          return sessionAbortControllers.get(sessionId);
        },
        setSessionAbortController: (
          sessionId: string,
          controller: AbortController | undefined,
        ) => {
          if (controller) {
            sessionAbortControllers.set(sessionId, controller);
          } else {
            sessionAbortControllers.delete(sessionId);
          }
        },

        // Per-session chat stop management
        setSessionChatStop: (
          sessionId: string,
          stopFn: (() => void) | undefined,
        ) => {
          if (stopFn) {
            sessionChatStops.set(sessionId, stopFn);
          } else {
            sessionChatStops.delete(sessionId);
          }
        },
        getSessionChatStop: (sessionId: string) => {
          return sessionChatStops.get(sessionId);
        },

        // Per-session chat sendMessage management
        setSessionChatSendMessage: (
          sessionId: string,
          sendMessageFn: ((message: {text: string}) => void) | undefined,
        ) => {
          if (sendMessageFn) {
            sessionChatSendMessages.set(sessionId, sendMessageFn);
          } else {
            sessionChatSendMessages.delete(sessionId);
          }
        },
        getSessionChatSendMessage: (sessionId: string) => {
          return sessionChatSendMessages.get(sessionId);
        },

        // Per-session addToolResult management
        setSessionAddToolResult: (
          sessionId: string,
          addToolResultFn: AddToolResult | undefined,
        ) => {
          if (addToolResultFn) {
            // Wrap addToolResult to intercept calls and resolve pending promises
            const wrappedAddToolResult: AddToolResult = (options) => {
              addToolResultFn(options);
              const resolver = pendingToolCallResolvers.get(options.toolCallId);
              if (resolver) {
                resolver.resolve();
              }
            };
            sessionAddToolResults.set(sessionId, wrappedAddToolResult);
          } else {
            sessionAddToolResults.delete(sessionId);
          }
        },
        getSessionAddToolResult: (sessionId: string) => {
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

        // Per-session analysis prompt management
        setSessionAnalysisPrompt: (sessionId: string, prompt: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.analysisPrompt = prompt;
              }
            }),
          );
        },
        getSessionAnalysisPrompt: (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: AnalysisSessionSchema) => s.id === sessionId,
          );
          return session?.analysisPrompt || '';
        },

        // Per-session running analysis state management
        setSessionIsRunningAnalysis: (
          sessionId: string,
          isRunning: boolean,
        ) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.isRunningAnalysis = isRunning;
              }
            }),
          );
        },
        getSessionIsRunningAnalysis: (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: AnalysisSessionSchema) => s.id === sessionId,
          );
          return session?.isRunningAnalysis || false;
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
                analysisPrompt: '',
                isRunningAnalysis: false,
              });
              draft.ai.config.currentSessionId = newSessionId;
            }),
          );
        },

        /**
         * Switch to a different session
         */
        switchSession: (sessionId: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.config.currentSessionId = sessionId;
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
            abortController.abort('Session deleted');
          }
          sessionAbortControllers.delete(sessionId);
          sessionChatStops.delete(sessionId);
          sessionChatSendMessages.delete(sessionId);
          sessionAddToolResults.delete(sessionId);

          set((state) =>
            produce(state, (draft) => {
              const sessionIndex = draft.ai.config.sessions.findIndex(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (sessionIndex !== -1) {
                // Don't delete the last session
                if (draft.ai.config.sessions.length > 1) {
                  draft.ai.config.sessions.splice(sessionIndex, 1);
                  // If we deleted the current session, switch to another one
                  if (draft.ai.config.currentSessionId === sessionId) {
                    // Make sure there's at least one session before accessing its id
                    if (draft.ai.config.sessions.length > 0) {
                      const firstSession = draft.ai.config.sessions[0];
                      if (firstSession) {
                        draft.ai.config.currentSessionId = firstSession.id;
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
          const currentSession = state.ai.getCurrentSession();
          const {
            systemInstructions,
            modelProvider,
            modelName,
            baseUrl,
            abortSignal,
            useTools = false,
          } = options;
          const provider =
            modelProvider || currentSession?.modelProvider || defaultProvider;
          const modelId = modelName || currentSession?.model || defaultModel;
          const baseURL =
            baseUrl ||
            state.ai.getBaseUrlFromSettings() ||
            'https://api.openai.com/v1';
          const tools = state.ai.tools;

          // remove execute from tools
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

          const sendMessage = state.ai.getSessionChatSendMessage(sessionId);
          if (!sendMessage) {
            console.error(
              'No sendMessage function found for session:',
              sessionId,
            );
            return;
          }

          const abortController = new AbortController();
          const promptText = session.analysisPrompt || '';

          // Store abort controller for this session
          state.ai.setSessionAbortController(sessionId, abortController);

          set((stateToUpdate) =>
            produce(stateToUpdate, (draft) => {
              const draftSession = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (draftSession) {
                draftSession.isRunningAnalysis = true;
                draftSession.analysisPrompt = '';
                draft.ai.promptSuggestionsVisible = false;

                // Remove any existing pending results
                draftSession.analysisResults =
                  draftSession.analysisResults.filter(
                    (result: AnalysisResultSchema) =>
                      result.id !== '__pending__',
                  );

                // Add incomplete analysis result with a temporary ID
                draftSession.analysisResults.push({
                  id: '__pending__',
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
          const abortController = state.ai.getSessionAbortController(sessionId);
          const stopFn = state.ai.getSessionChatStop(sessionId);

          // Stop local chat streaming immediately if available
          try {
            stopFn?.();
          } catch {
            // no-op
          }

          // Call abort to signal cancellation
          abortController?.abort('Analysis cancelled');

          set((stateToUpdate) =>
            produce(stateToUpdate, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.isRunningAnalysis = false;
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

        getLocalChatTransport: () => {
          const state = get();
          return createLocalChatTransportFactory({
            store,
            defaultProvider: defaultProvider,
            defaultModel: defaultModel,
            apiKey: state.ai.getApiKeyFromSettings(),
            baseUrl: state.ai.getBaseUrlFromSettings(),
            getInstructions: () => store.getState().ai.getFullInstructions(),
            getCustomModel,
          })();
        },

        getRemoteChatTransport: (
          endpoint: string,
          headers?: Record<string, string>,
        ) =>
          createRemoteChatTransportFactory({
            store,
            defaultProvider,
            defaultModel,
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
