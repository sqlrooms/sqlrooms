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
import {DefaultToolsOptions, getDefaultTools} from './analysis';
import {AnalysisSessionSchema} from './schemas';
import {UIMessage, DefaultChatTransport} from 'ai';

import {
  createLocalChatTransportFactory,
  createRemoteChatTransportFactory,
  createChatHandlers,
} from './llm';

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
    setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
    setSessionToolAdditionalData: (
      sessionId: string,
      updater:
        | Record<string, unknown>
        | ((prev: Record<string, unknown>) => Record<string, unknown>),
    ) => void;
    createSession: (
      name?: string,
      modelProvider?: string,
      model?: string,
    ) => void;
    switchSession: (sessionId: string) => void;
    renameSession: (sessionId: string, name: string) => void;
    deleteSession: (sessionId: string) => void;
    getCurrentSession: () => AnalysisSessionSchema | undefined;
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    findToolComponent: (toolName: string) => React.ComponentType | undefined;
    /** Returns a chat transport configured with current provider/model, apiKey and baseUrl */
    getLocalChatTransport: () => DefaultChatTransport<UIMessage>;
    /** Returns a chat transport that proxies to a remote endpoint (UIMessage stream) */
    getRemoteChatTransport: (
      endpoint: string,
      headers?: Record<string, string>,
    ) => DefaultChatTransport<UIMessage>;
    /** Optional remote endpoint to use for chat; if empty, local transport is used */
    endPoint: string;
    /** Optional headers to send with remote endpoint */
    headers: Record<string, string>;
    /** Chat handler: tool calls from the model */
    onChatToolCall: (args: {toolCall: unknown}) => Promise<void> | void;
    /** Chat handler: final assistant message */
    onChatFinish: (args: {
      message: UIMessage;
      messages: UIMessage[];
      isError?: boolean;
    }) => void;
    /** Chat handler: error */
    onChatError: (error: unknown) => void;
    /** Initialize toolAdditionalData from the current session */
    initializeToolAdditionalData: () => void;
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
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string | undefined;
  getMaxSteps?: () => number;
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
    getApiKey,
    getBaseUrl,
    // getMaxSteps,
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
                  // Ignore streamMessage to reduce payload size
                  streamMessage: {},
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
          const promptText = get().ai.analysisPrompt;
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) {
            console.error('No current session found');
            return;
          }

          const newResultId = createId();

          set((state) =>
            produce(state, (draft) => {
              // mark running and create controller
              draft.ai.isRunningAnalysis = true;
              draft.ai.analysisAbortController = new AbortController();

              // create a new analysis result for this prompt (ignore streamMessage)
              const session = draft.config.ai.sessions.find(
                (s) => s.id === currentSession.id,
              );
              if (session) {
                session.analysisResults.push({
                  id: newResultId,
                  prompt: promptText,
                  streamMessage: {},
                  isCompleted: false,
                });
              }
            }),
          );

          // Delegate to chat hook; lifecycle managed by onChatFinish/onChatError
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
         */
        deleteAnalysisResult: (sessionId: string, resultId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.config.ai.sessions.find(
                (s) => s.id === sessionId,
              );
              if (session) {
                session.analysisResults = session.analysisResults.filter(
                  (r) => r.id !== resultId,
                );
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
            getApiKey,
            getBaseUrl,
            getInstructions,
          })(),

        getRemoteChatTransport: (
          endpoint: string,
          headers?: Record<string, string>,
        ) => createRemoteChatTransportFactory()(endpoint, headers),

        ...createChatHandlers({get, set}),

        /** no-op kept for backward compatibility */
        initializeToolAdditionalData: () => {},
      },
    };
  });
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
