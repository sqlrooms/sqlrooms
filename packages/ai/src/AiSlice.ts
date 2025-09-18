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
import {
  DefaultToolsOptions,
  getDefaultTools,
  getDefaultInstructions,
} from './analysis';
import {AnalysisSessionSchema} from './schemas';
import {
  UIMessage,
  DefaultChatTransport,
  LanguageModel,
  convertToModelMessages,
  streamText,
} from 'ai';
import {createOpenAI} from '@ai-sdk/openai';
import {convertToVercelAiTool} from './utils';

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
    /** Map of toolCallId to additionalData emitted by tools */
    toolAdditionalData?: Record<string, unknown>;
    analysisAbortController?: AbortController;
    setAnalysisPrompt: (prompt: string) => void;
    addAnalysisResult: (message: UIMessage) => void;
    startAnalysis: (
      sendMessage: (message: {text: string}) => void,
    ) => Promise<void>;
    cancelAnalysis: () => void;
    setAiModel: (modelProvider: string, model: string) => void;
    setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
    setToolAdditionalData?: (
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
    getChatTransport: () => DefaultChatTransport<UIMessage>;
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

        tools: {
          ...getDefaultTools(store, toolsOptions),
          ...customTools,
        },

        toolAdditionalData: {},

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

        setToolAdditionalData: (updater) => {
          set((state) =>
            produce(state, (draft) => {
              const prev = draft.ai.toolAdditionalData || {};
              draft.ai.toolAdditionalData =
                typeof updater === 'function'
                  ? (
                      updater as (
                        p: Record<string, unknown>,
                      ) => Record<string, unknown>
                    )(prev)
                  : updater;
            }),
          );
        },

        /**
         * Get the current active session
         */
        getCurrentSession: () => {
          const state = get();
          const {currentSessionId, sessions} = state.config.ai;
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
              draft.config.ai.sessions.unshift({
                id: newSessionId,
                name: sessionName,
                modelProvider:
                  modelProvider || currentSession?.modelProvider || 'openai',
                model: model || currentSession?.model || 'gpt-4.1',
                analysisResults: [],
                createdAt: new Date(),
                uiMessages: [],
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
                  streamMessage: JSON.parse(JSON.stringify(message)), // Deep copy to avoid read-only issues
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
          set((state) =>
            produce(state, (draft) => {
              draft.ai.isRunningAnalysis = true;
              // Create a fresh controller for this analysis run
              draft.ai.analysisAbortController = new AbortController();
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

        getChatTransport: () => {
          const state = get();
          const currentSession = state.ai.getCurrentSession();
          const provider = currentSession?.modelProvider || defaultProvider;
          const modelId = currentSession?.model || defaultModel;
          const apiKey = getApiKey?.(provider) || '';
          const baseUrl = getBaseUrl?.();

          const openai = createOpenAI({
            apiKey,
            baseURL: baseUrl,
          });

          const fetchImpl = async (
            _input: RequestInfo | URL,
            init?: RequestInit,
          ) => {
            try {
              const body = init?.body as string;
              const parsed = body ? JSON.parse(body) : {};
              const messagesCopy = JSON.parse(
                JSON.stringify(parsed.messages || []),
              );

              // Build tool wrappers for AI SDK v5 streamText
              const onToolCompleted = (
                toolCallId: string,
                additionalData: unknown,
              ) => {
                get().ai.setToolAdditionalData?.((prev) => ({
                  ...prev,
                  [toolCallId]: additionalData,
                }));
              };

              const tools = Object.entries(get().ai.tools || {}).reduce(
                (
                  acc: Record<string, ReturnType<typeof convertToVercelAiTool>>,
                  [name, tool],
                ) => {
                  acc[name] = convertToVercelAiTool({
                    tool,
                    onToolCompleted,
                  });
                  return acc;
                },
                {} as Record<string, ReturnType<typeof convertToVercelAiTool>>,
              );

              // get system instructions
              const tableSchemas = get().db.tables;
              const systemInstructions = getInstructions
                ? getInstructions(tableSchemas)
                : getDefaultInstructions(tableSchemas);

              const result = streamText({
                model: openai(modelId) as unknown as LanguageModel,
                messages: convertToModelMessages(messagesCopy),
                tools: tools,
                system: systemInstructions,
                abortSignal: get().ai.analysisAbortController?.signal,
              });

              return result.toUIMessageStreamResponse();
            } catch (error) {
              console.error('Error in getChatTransport.fetch:', error);
              throw error;
            }
          };

          return new DefaultChatTransport({fetch: fetchImpl});
        },

        onChatToolCall: async ({toolCall}) => {
          void toolCall;
          // no-op for now; UI messages are synced on finish via useChat
        },

        onChatFinish: ({message, messages}) => {
          try {
            void message; // kept for potential analytics; we store full messages
            const currentSessionId = get().config.ai.currentSessionId;
            if (!currentSessionId) return;
            get().ai.setSessionUiMessages(currentSessionId, messages);
            set((state) =>
              produce(state, (draft) => {
                draft.ai.isRunningAnalysis = false;
                draft.ai.analysisPrompt = '';
                draft.ai.analysisAbortController = undefined;
              }),
            );
          } catch (err) {
            console.error('onChatFinish error:', err);
          }
        },

        onChatError: (error: unknown) => {
          console.error('Chat error:', error);
        },
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

// Legacy helpers removed as runAnalysis is deprecated

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
