import {createId} from '@paralleldrive/cuid2';
import {
  AiSliceConfig,
  AnalysisResultSchema,
  AnalysisSessionSchema,
  createDefaultAiConfig,
} from '@sqlrooms/ai-config';
import {
  BaseRoomConfig,
  createBaseSlice,
  RoomState,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {UIMessage, DefaultChatTransport, LanguageModel} from 'ai';

import {
  createLocalChatTransportFactory,
  createRemoteChatTransportFactory,
  createChatHandlers,
} from './chatTransport';
import {hasAiSettingsConfig} from './hasAiSettingsConfig';
import {OpenAssistantToolSet} from '@openassistant/utils';

export type AiSliceState = {
  ai: {
    config: AiSliceConfig;
    analysisPrompt: string;
    isRunningAnalysis: boolean;
    tools: OpenAssistantToolSet;
    analysisAbortController?: AbortController;
    setAnalysisPrompt: (prompt: string) => void;
    addAnalysisResult: (message: UIMessage) => void;
    startAnalysis: (
      sendMessage: (message: {text: string}) => void,
    ) => Promise<void>;
    cancelAnalysis: () => void;
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
    getAnalysisResults: () => AnalysisResultSchema[];
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    getAssistantMessageParts: (analysisResultId: string) => UIMessage['parts'];
    findToolComponent: (toolName: string) => React.ComponentType | undefined;
    getApiKeyFromSettings: () => string;
    getBaseUrlFromSettings: () => string | undefined;
    getMaxStepsFromSettings: () => number;
    getFullInstructions: () => string;
    // Chat transport for useChat hook
    /** Optional remote endpoint to use for chat; if empty, local transport is used */
    chatEndPoint: string;
    /** Optional headers to send with remote endpoint */
    chatHeaders: Record<string, string>;
    /** Get local chat transport for AI communication */
    getLocalChatTransport: () => DefaultChatTransport<UIMessage>;
    /** Get remote chat transport for AI communication */
    getRemoteChatTransport: (
      endpoint: string,
      headers?: Record<string, string>,
    ) => DefaultChatTransport<UIMessage>;
    /** Chat handler: tool calls locally */
    onChatToolCall: (args: {toolCall: unknown}) => Promise<void> | void;
    /** Chat handler: final assistant message */
    onChatFinish: (args: {
      message: UIMessage;
      messages: UIMessage[];
      isError?: boolean;
    }) => void;
    /** Chat handler: error */
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
  maxSteps?: number;
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string;
}

export function createAiSlice<PC extends BaseRoomConfig>(
  params: AiSliceOptions,
): StateCreator<AiSliceState> {
  const {
    initialAnalysisPrompt = '',
    tools,
    getApiKey,
    getBaseUrl,
    maxSteps,
    getInstructions,
    defaultProvider = 'openai',
    defaultModel = 'gpt-4.1',
    getCustomModel,
  } = params;

  return createBaseSlice<PC, AiSliceState>((set, get) => {
    return {
      ai: {
        config: createDefaultAiConfig(params.config),
        analysisPrompt: initialAnalysisPrompt,
        isRunningAnalysis: false,
        tools,

        setAnalysisPrompt: (prompt: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.analysisPrompt = prompt;
            }),
          );
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
              // Add to AI sessions
              draft.ai.config.sessions.unshift({
                id: newSessionId,
                name: sessionName,
                modelProvider:
                  modelProvider || currentSession?.modelProvider || 'openai',
                model: model || currentSession?.model || 'gpt-4.1',
                analysisResults: [],
                createdAt: new Date(),
                uiMessages: [],
                toolAdditionalData: {},
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
         * Delete a session
         */
        deleteSession: (sessionId: string) => {
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
          return Object.entries(get().ai.tools).find(
            ([name]) => name === toolName,
          )?.[1]?.component as React.ComponentType;
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
          return 5;
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

        /**
         * Start the analysis
         * TODO: how to pass the history analysisResults?
         */
        startAnalysis: async (
          sendMessage: (message: {text: string}) => void,
        ) => {
          const abortController = new AbortController();
          const currentSession = get().ai.getCurrentSession();

          if (!currentSession) {
            console.error('No current session found');
            return;
          }

          set((state) =>
            produce(state, (draft) => {
              draft.ai.analysisAbortController = abortController;
              draft.ai.isRunningAnalysis = true;
            }),
          );

          // Delegate to chat hook; lifecycle managed by onChatFinish/onChatError
          // Analysis result will be created in onChatFinish with the correct message ID
          sendMessage({text: get().ai.analysisPrompt});
        },

        cancelAnalysis: () => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.isRunningAnalysis = false;
            }),
          );
          get().ai.analysisAbortController?.abort('Analysis cancelled');
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
                  const toolCallIdsToDelete: string[] = [];

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
                          toolCallIdsToDelete.push(part.toolCallId);
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

                  // Clean up toolAdditionalData for deleted messages
                  if (session.toolAdditionalData) {
                    // Remove data keyed by the toolCallId from the deleted messages
                    toolCallIdsToDelete.forEach((toolCallId) => {
                      if (
                        session.toolAdditionalData &&
                        session.toolAdditionalData[toolCallId]
                      ) {
                        delete session.toolAdditionalData[toolCallId];
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
        getAnalysisResults: (): AnalysisResultSchema[] => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) return [];

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
        chatEndPoint: '',
        chatHeaders: {},

        getLocalChatTransport: () => {
          const state = get();
          return createLocalChatTransportFactory({
            get: () => get(),
            defaultProvider: defaultProvider,
            defaultModel: defaultModel,
            apiKey: state.ai.getApiKeyFromSettings(),
            baseUrl: state.ai.getBaseUrlFromSettings(),
            getInstructions: () => get().ai.getFullInstructions(),
            getCustomModel,
          })();
        },

        getRemoteChatTransport: (
          endpoint: string,
          headers?: Record<string, string>,
        ) => createRemoteChatTransportFactory()(endpoint, headers),

        ...createChatHandlers({get, set}),
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

export function useStoreWithAi<
  T,
  PC extends BaseRoomConfig,
  S extends RoomState<PC> & AiSliceState,
>(selector: (state: S) => T): T {
  return useBaseRoomStore<PC, RoomState<PC>, T>((state) =>
    selector(state as unknown as S),
  );
}
