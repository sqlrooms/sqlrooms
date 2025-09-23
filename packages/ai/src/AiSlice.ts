import {ExtendedTool} from '@openassistant/utils';
import {createId} from '@paralleldrive/cuid2';
import {DataTable} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
  useBaseRoomShellStore,
  type StateCreator,
} from '@sqlrooms/room-shell';
import {produce, WritableDraft} from 'immer';
import {z} from 'zod';
import {AnalysisSessionSchema, AnalysisResultSchema} from './schemas';
import {UIMessagePart} from './schema/UIMessageSchema';
import {UIMessage, DefaultChatTransport} from 'ai';

import {
  createLocalChatTransportFactory,
  createRemoteChatTransportFactory,
  createChatHandlers,
  type LlmDeps,
} from './llm';
import {
  DefaultToolsOptions,
  getDefaultInstructions,
  getDefaultTools,
} from './analysis';
import {AiSettingsSliceConfig} from './AiSettingsSlice';

export const AiSliceConfig = z.object({
  ai: z.object({
    sessions: z.array(AnalysisSessionSchema),
    currentSessionId: z.string().optional(),
  }),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(
  props: Partial<AiSliceConfig['ai']>,
): AiSliceConfig {
  const defaultSessionId = createId();
  const config = {
    ai: {
      sessions: [
        {
          id: defaultSessionId,
          name: 'Default Session',
          modelProvider: 'openai',
          model: 'gpt-4.1',
          analysisResults: [],
          createdAt: new Date(),
          uiMessages: [],
          toolAdditionalData: {},
        },
      ],
      currentSessionId: defaultSessionId,
      ...props,
    },
  };
  return config;
}

// template for the tool: Argument, LLM Result, Additional Data, Context
export type AiSliceTool = ExtendedTool<z.ZodTypeAny, unknown, unknown, unknown>;

export type AiSliceState = {
  ai: {
    analysisPrompt: string;
    isRunningAnalysis: boolean;
    tools: Record<string, AiSliceTool>;
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
    getAnalysisResults: () => AnalysisResultSchema[];
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    findToolComponent: (toolName: string) => React.ComponentType | undefined;
    getApiKeyFromSettings: () => string;
    getBaseUrlFromSettings: () => string | undefined;
    getMaxStepsFromSettings: () => number;
    getInstructionsFromSettings: () => string;
    setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
    setSessionToolAdditionalData: (
      sessionId: string,
      updater:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>),
    ) => void;
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
  /** Initial prompt to display in the analysis input */
  initialAnalysisPrompt?: string;
  /** Custom tools to add to the AI assistant */
  customTools?: Record<string, AiSliceTool>;
  /**
   * Function to get custom instructions for the AI assistant
   * @param tablesSchema - The schema of the tables in the database
   * @returns The instructions string to use
   */
  getInstructions?: (tablesSchema: DataTable[]) => string;
  toolsOptions?: DefaultToolsOptions;
  defaultProvider?: string;
  defaultModel?: string;
  /** Provide a pre-configured model client for a provider (e.g., Azure). */
  getModelClientForProvider?: LlmDeps['getModelClientForProvider'];
  maxSteps?: number;
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string;
}

export function createAiSlice<PC extends BaseRoomConfig & AiSliceConfig>(
  params: AiSliceOptions,
): StateCreator<AiSliceState> {
  const {
    defaultProvider = 'openai',
    defaultModel = 'gpt-4.1',
    initialAnalysisPrompt = '',
    customTools = {},
    toolsOptions,
    getModelClientForProvider,
    getApiKey,
    getBaseUrl,
    maxSteps,
    getInstructions,
  } = params;

  return createSlice<PC, AiSliceState>((set, get, store) => {
    return {
      ai: {
        analysisPrompt: initialAnalysisPrompt,
        isRunningAnalysis: false,
        maxSteps: 5,
        endPoint: '',
        headers: {},

        tools: {
          ...getDefaultTools(store, toolsOptions),
          ...customTools,
        },

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

        setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.config.ai.sessions.find(
                (s) => s.id === sessionId,
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
              const session = draft.config.ai.sessions.find(
                (s) => s.id === sessionId,
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
         * Get the current active session
         */
        getCurrentSession: () => {
          const state = get();
          const {currentSessionId, sessions} = state.config.ai;
          const session = sessions.find(
            (session) => session.id === currentSessionId,
          );
          return session;
        },

        /**
         * Get analysis results from the current session's UI messages
         */
        getAnalysisResults: (): AnalysisResultSchema[] => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession?.uiMessages?.length) return [];

          const results: AnalysisResultSchema[] = [];
          let i = 0;

          while (i < currentSession.uiMessages.length) {
            const userMessage = currentSession.uiMessages[i];

            // Skip non-user messages
            if (!userMessage || userMessage.role !== 'user') {
              i++;
              continue;
            }

            // Extract user prompt text
            const prompt = userMessage.parts
              .filter(
                (part): part is {type: 'text'; text: string} =>
                  part.type === 'text',
              )
              .map((part) => part.text)
              .join('');

            // Find the assistant response
            let response: UIMessagePart[] = [];
            let isCompleted = false;
            let nextIndex = i + 1;

            for (let j = i + 1; j < currentSession.uiMessages.length; j++) {
              const nextMessage = currentSession.uiMessages[j];
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
              (result) => result.id === userMessage.id,
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
              draft.config.ai.sessions.unshift({
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
              draft.config.ai.currentSessionId = newSessionId;
            }),
          );
        },

        /**
         * Switch to a different session
         */
        switchSession: (sessionId: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.config.ai.currentSessionId = sessionId;
            }),
          );
        },

        /**
         * Rename an existing session
         */
        renameSession: (sessionId: string, name: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.config.ai.sessions.find(
                (s) => s.id === sessionId,
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
              const sessionIndex = draft.config.ai.sessions.findIndex(
                (s) => s.id === sessionId,
              );
              if (sessionIndex !== -1) {
                // Don't delete the last session
                if (draft.config.ai.sessions.length > 1) {
                  draft.config.ai.sessions.splice(sessionIndex, 1);
                  // If we deleted the current session, switch to another one
                  if (draft.config.ai.currentSessionId === sessionId) {
                    // Make sure there's at least one session before accessing its id
                    if (draft.config.ai.sessions.length > 0) {
                      const firstSession = draft.config.ai.sessions[0];
                      if (firstSession) {
                        draft.config.ai.currentSessionId = firstSession.id;
                      }
                    }
                  }
                }
              }
            }),
          );
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

              draft.config.ai.sessions
                .find((s) => s.id === currentSession?.id)
                ?.analysisResults.push({
                  id: resultId,
                  prompt: textContent,
                  response: [],
                  isCompleted: true,
                });
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
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) {
            console.error('No current session found');
            return;
          }

          set((state) =>
            produce(state, (draft) => {
              // mark running and create controller
              draft.ai.isRunningAnalysis = true;
              draft.ai.analysisAbortController = new AbortController();
            }),
          );

          // Delegate to chat hook; lifecycle managed by onChatFinish/onChatError
          // Analysis result will be created in onChatFinish with the correct message ID
          sendMessage({text: get().ai.analysisPrompt});
        },

        cancelAnalysis: () => {
          const controller = get().ai.analysisAbortController;
          controller?.abort('Analysis cancelled');
          set((state) =>
            produce(state, (draft) => {
              draft.ai.isRunningAnalysis = false;
              draft.ai.analysisAbortController = undefined;
            }),
          );
        },

        /**
         * Delete an analysis result from a session
         * Also removes the corresponding prompt-response pair from uiMessages
         */
        deleteAnalysisResult: (sessionId: string, resultId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.config.ai.sessions.find(
                (s) => s.id === sessionId,
              );
              if (session) {
                // Remove from analysisResults by matching the ID
                session.analysisResults = session.analysisResults.filter(
                  (r) => r.id !== resultId,
                );

                // Remove corresponding prompt-response pair from uiMessages
                const userMessageIndex = session.uiMessages.findIndex(
                  (msg) => msg.id === resultId && msg.role === 'user',
                );

                if (userMessageIndex !== -1) {
                  // Find the next user message (or end of array) to determine response boundary
                  let nextUserIndex = userMessageIndex + 1;
                  while (
                    nextUserIndex < session.uiMessages.length &&
                    session.uiMessages[nextUserIndex]?.role !== 'user'
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

        findToolComponent: (toolName: string) => {
          return Object.entries(get().ai.tools).find(
            ([name]) => name === toolName,
          )?.[1]?.component as React.ComponentType;
        },

        getLocalChatTransport: () =>
          createLocalChatTransportFactory({
            get,
            defaultProvider,
            defaultModel,
            apiKey: get().ai.getApiKeyFromSettings(),
            baseUrl: get().ai.getBaseUrlFromSettings(),
            instructions: get().ai.getInstructionsFromSettings(),
            getModelClientForProvider,
          })(),

        getRemoteChatTransport: (
          endpoint: string,
          headers?: Record<string, string>,
        ) => createRemoteChatTransportFactory()(endpoint, headers),

        ...createChatHandlers({get, set}),

        getBaseUrlFromSettings: () => {
          // First try the getBaseUrl function if provided
          const baseUrlFromFunction = getBaseUrl?.();
          if (baseUrlFromFunction) {
            return baseUrlFromFunction;
          }

          // Fall back to settings
          const store = get();
          if (hasAiSettings(store.config)) {
            const currentSession = getCurrentSessionFromState(store);
            if (currentSession) {
              if (currentSession.modelProvider === 'custom') {
                const customModel = store.config.aiSettings.customModels.find(
                  (m: {modelName: string}) =>
                    m.modelName === currentSession.model,
                );
                return customModel?.baseUrl;
              }
              const provider =
                store.config.aiSettings.providers[currentSession.modelProvider];
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
            if (hasAiSettings(store.config)) {
              if (currentSession.modelProvider === 'custom') {
                const customModel = store.config.aiSettings.customModels.find(
                  (m: {modelName: string}) =>
                    m.modelName === currentSession.model,
                );
                return customModel?.apiKey || '';
              } else {
                const provider =
                  store.config.aiSettings.providers?.[
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
          if (hasAiSettings(store.config)) {
            const settingsMaxSteps =
              store.config.aiSettings.modelParameters.maxSteps;
            if (Number.isFinite(settingsMaxSteps) && settingsMaxSteps > 0) {
              return settingsMaxSteps;
            }
          }
          return 5;
        },

        getInstructionsFromSettings: () => {
          const store = get();
          const tablesSchema = store.db?.tables || [];

          // First try the getInstructions function if provided
          if (getInstructions) {
            return getInstructions(tablesSchema);
          }

          // Fall back to settings
          if (hasAiSettings(store.config)) {
            let instructions = tablesSchema
              ? getDefaultInstructions(tablesSchema)
              : '';
            // get additional instructions from settings
            const customInstructions =
              store.config.aiSettings.modelParameters.additionalInstruction;
            if (customInstructions) {
              instructions = `${instructions}\n\nAdditional Instructions:\n\n${customInstructions}`;
            }
            return instructions;
          }
          return '';
        },
      },
    };
  });
}

/**
 * Helper function to type guard the store config if we have aiSettings
 * @param storeConfig
 * @returns
 */
function hasAiSettings(
  storeConfig: unknown,
): storeConfig is {aiSettings: AiSettingsSliceConfig['aiSettings']} {
  return (
    typeof storeConfig === 'object' &&
    storeConfig !== null &&
    'aiSettings' in storeConfig
  );
}

/**
 * Helper function to get the current session from state
 */
function getCurrentSessionFromState<PC extends BaseRoomConfig & AiSliceConfig>(
  state: RoomShellSliceState<PC> | WritableDraft<RoomShellSliceState<PC>>,
): AnalysisSessionSchema | undefined {
  const {currentSessionId, sessions} = state.config.ai;
  return sessions.find((session) => session.id === currentSessionId);
}

// Keep typed hook for selecting from store with Ai slice
type RoomConfigWithAi = BaseRoomConfig & AiSliceConfig;
type RoomShellSliceStateWithAi = RoomShellSliceState<RoomConfigWithAi> &
  AiSliceState;

export function useStoreWithAi<T>(
  selector: (state: RoomShellSliceStateWithAi) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & AiSliceConfig,
    RoomShellSliceState<RoomConfigWithAi>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithAi));
}
