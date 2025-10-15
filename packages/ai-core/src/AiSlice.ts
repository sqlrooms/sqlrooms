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
import {UIMessage, DefaultChatTransport} from 'ai';

import {
  createLocalChatTransportFactory,
  createRemoteChatTransportFactory,
  createChatHandlers,
  type LlmDeps,
} from './chatTransport';
import {hasAiSettingsConfig} from './hasAiSettingsConfig';
import {UIMessagePart} from '@sqlrooms/ai-config/src/UIMessageSchema';
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
      updater:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>),
    ) => void;
    getAnalysisResults: () => AnalysisResultSchema[];
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    findToolComponent: (toolName: string) => React.ComponentType | undefined;
    getApiKeyFromSettings: () => string;
    getBaseUrlFromSettings: () => string | undefined;
    getMaxStepsFromSettings: () => number;
    getFullInstructions: () => string;
    // TODO: move the following methods to AiChatSlice
    getLocalChatTransport: () => DefaultChatTransport<UIMessage>;
    getRemoteChatTransport: (
      endpoint: string,
      headers?: Record<string, string>,
    ) => DefaultChatTransport<UIMessage>;
    /** Optional remote endpoint to use for chat; if empty, local transport is used */
    endPoint: string;
    /** Optional headers to send with remote endpoint */
    headers: Record<string, string>;
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
  getModelClientForProvider?: LlmDeps['getModelClientForProvider'];
  maxSteps?: number;
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string;
}

export function createAiSlice<PC extends BaseRoomConfig>(
  params: AiSliceOptions,
): StateCreator<AiSliceState> {
  const {
    defaultProvider = 'openai',
    defaultModel = 'gpt-4.1',
    getModelClientForProvider,
    initialAnalysisPrompt = '',
    tools,
    getApiKey,
    getBaseUrl,
    maxSteps,
    getInstructions,
  } = params;

  return createBaseSlice<PC, AiSliceState>((set, get, store) => {
    return {
      ai: {
        config: createDefaultAiConfig(params.config),
        analysisPrompt: initialAnalysisPrompt,
        isRunningAnalysis: false,
        endPoint: '',
        headers: {},
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

        setSessionToolAdditionalData: (
          sessionId: string,
          updater:
            | Record<string, unknown>
            | ((prev: Record<string, unknown>) => Record<string, unknown>),
        ) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: {
                  id: string;
                  toolAdditionalData: Record<string, unknown>;
                }) => s.id === sessionId,
              );
              if (session) {
                const prev = session.toolAdditionalData || {};
                session.toolAdditionalData =
                  typeof updater === 'function'
                    ? (
                        updater as (
                          p: Record<string, unknown>,
                        ) => Record<string, unknown>
                      )(prev)
                    : updater;
              }
            }),
          );
        },

        /**
         * Start the analysis
         * TODO: how to pass the history analysisResults?
         */
        startAnalysis: async (
          sendMessage: (message: {text: string}) => void,
        ) => {
          const resultId = createId();
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
         * Delete an analysis result from a session
         * Also removes the corresponding prompt-response pair from uiMessages
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
                  while (
                    nextUserIndex < uiMessages.length &&
                    uiMessages[nextUserIndex]?.role !== 'user'
                  ) {
                    nextUserIndex++;
                  }

                  // Remove the user message and all assistant messages until the next user message
                  session.uiMessages.splice(
                    userMessageIndex,
                    nextUserIndex - userMessageIndex,
                  );
                }
              }
            }),
          );
        },

        getLocalChatTransport: () =>
          createLocalChatTransportFactory({
            get,
            defaultProvider,
            defaultModel,
            apiKey: get().ai.getApiKeyFromSettings(),
            baseUrl: get().ai.getBaseUrlFromSettings(),
            instructions: get().ai.getFullInstructions(),
            getModelClientForProvider,
          })(),

        getRemoteChatTransport: (
          endpoint: string,
          headers?: Record<string, string>,
        ) => createRemoteChatTransportFactory()(endpoint, headers),

        ...createChatHandlers({get, set}),

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
              currentSession.modelProvider || defaultProvider,
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
         * Get analysis results from the current session's UI messages
         */
        getAnalysisResults: (): AnalysisResultSchema[] => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession?.uiMessages?.length) return [];

          const results: AnalysisResultSchema[] = [];
          let i = 0;
          const uiMessages = currentSession.uiMessages as UIMessage[];

          while (i < uiMessages.length) {
            const userMessage = uiMessages[i];

            // Skip non-user messages
            if (!userMessage || userMessage.role !== 'user') {
              i++;
              continue;
            }

            // Extract user prompt text
            const prompt = userMessage.parts
              .filter(
                (part: UIMessagePart): part is {type: 'text'; text: string} =>
                  part.type === 'text',
              )
              .map((part: {type: 'text'; text: string}) => part.text)
              .join('');

            // Find the assistant response
            let response: UIMessagePart[] = [];
            let isCompleted = false;
            let nextIndex = i + 1;

            for (let j = i + 1; j < uiMessages.length; j++) {
              const nextMessage = uiMessages[j];
              if (!nextMessage) continue;

              if (nextMessage.role === 'assistant') {
                response = nextMessage.parts;
                isCompleted = true;
                nextIndex = j + 1; // Skip past the assistant message
                break;
              } else if (nextMessage.role === 'user') {
                // Stop at next user message
                nextIndex = j;
                break;
              }
            }

            // Check if there's a related item in currentSession.analysisResults
            const relatedAnalysisResult = currentSession.analysisResults?.find(
              (result: AnalysisResultSchema) => result.id === userMessage.id,
            );

            results.push({
              id: userMessage.id,
              prompt,
              response,
              errorMessage: relatedAnalysisResult?.errorMessage,
              isCompleted,
            });

            i = nextIndex;
          }

          return results;
        },

        addAnalysisResult: (message: UIMessage) => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) {
            console.error('No current session found');
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              const resultId = createId();
              // Extract text content from message parts
              const textContent =
                message.parts
                  ?.filter((part) => part.type === 'text')
                  ?.map((part) => (part as {text: string}).text)
                  ?.join('') || '';

              draft.ai.config.sessions
                .find((s: AnalysisSessionSchema) => s.id === currentSession?.id)
                ?.analysisResults.push({
                  id: resultId,
                  prompt: textContent,
                  response: [],
                  isCompleted: true,
                });
            }),
          );
        },
      },
    };
  });
}

/**
 * Helper function to get the current session from state
 */
function getCurrentSessionFromState<PC extends BaseRoomConfig>(
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
