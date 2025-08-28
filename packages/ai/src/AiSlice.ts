import {StreamMessage} from '@openassistant/core';
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
import {getDefaultTools, runAnalysis} from './analysis';
import {
  AnalysisResultSchema,
  AnalysisSessionSchema,
  ErrorMessageSchema,
} from './schemas';

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
  return {
    ai: {
      sessions: [
        {
          id: defaultSessionId,
          name: 'Default Session',
          modelProvider: 'openai',
          model: 'gpt-4o-mini',
          analysisResults: [],
          createdAt: new Date(),
        },
      ],
      currentSessionId: defaultSessionId,
      ...props,
    },
  };
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
    startAnalysis: () => Promise<void>;
    cancelAnalysis: () => void;
    setAiModel: (modelProvider: string, model: string) => void;
    setCustomModelName: (customModelName: string) => void;
    setBaseUrl: (baseUrl: string) => void;
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
  /**
   * Number of rows to share with LLM (default: 0)
   */
  numberOfRowsToShareWithLLM?: number;
}

/**
 * API key configuration for the AI slice
 */
export type AiSliceApiConfig = {defaultModel?: string} & (
  | {baseUrl: string; getApiKey?: never}
  | {getApiKey: (modelProvider: string) => string; baseUrl?: never}
);

/**
 * Complete configuration for creating an AI slice
 */
export type CreateAiSliceConfig = AiSliceOptions & AiSliceApiConfig;

export function createAiSlice<PC extends BaseRoomConfig & AiSliceConfig>(
  params: CreateAiSliceConfig,
): StateCreator<AiSliceState> {
  const {
    getApiKey,
    baseUrl,
    initialAnalysisPrompt = '',
    customTools = {},
    getInstructions,
    numberOfRowsToShareWithLLM,
    defaultModel = 'gpt-4o-mini',
  } = params;

  return createSlice<PC, AiSliceState>((set, get, store) => {
    return {
      ai: {
        analysisPrompt: initialAnalysisPrompt,
        isRunningAnalysis: false,

        tools: {
          ...getDefaultTools(store, numberOfRowsToShareWithLLM),
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

        /**
         * Set the custom model name for the current session
         * @param customModelName - The custom model name to set
         */
        setCustomModelName: (customModelName: string) => {
          set((state) =>
            produce(state, (draft) => {
              const currentSession = getCurrentSessionFromState(draft);
              if (currentSession) {
                currentSession.customModelName = customModelName;
              }
            }),
          );
        },

        /**
         * Set the base URL for the current session
         * @param baseUrl - The server URL to set
         */
        setBaseUrl: (baseUrl: string) => {
          set((state) =>
            produce(state, (draft) => {
              const currentSession = getCurrentSessionFromState(draft);
              if (currentSession) {
                currentSession.baseUrl = baseUrl;
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
              draft.config.ai.sessions.unshift({
                id: newSessionId,
                name: sessionName,
                modelProvider:
                  modelProvider || currentSession?.modelProvider || 'openai',
                model: model || currentSession?.model || 'gpt-4.1',
                analysisResults: [],
                createdAt: new Date(),
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

        /**
         * Start the analysis
         * TODO: how to pass the history analysisResults?
         */
        startAnalysis: async () => {
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

              const session = draft.config.ai.sessions.find(
                (s) => s.id === draft.config.ai.currentSessionId,
              );

              if (session) {
                session.analysisResults.push({
                  id: resultId,
                  prompt: get().ai.analysisPrompt,
                  streamMessage: {
                    parts: [
                      {
                        type: 'text',
                        text: '',
                      },
                    ],
                  },
                  isCompleted: false,
                });
              }
            }),
          );

          try {
            await runAnalysis({
              tableSchemas: get().db.tables,
              modelProvider: currentSession.modelProvider || 'openai',
              model: currentSession.model || defaultModel,
              customModelName: currentSession.customModelName,
              apiKey:
                getApiKey?.(currentSession.modelProvider || 'openai') || '',
              baseUrl: currentSession.baseUrl || baseUrl,
              prompt: get().ai.analysisPrompt,
              abortController,
              tools: {
                ...getDefaultTools(store, numberOfRowsToShareWithLLM),
                ...customTools,
              },
              getInstructions,
              onStreamResult: (isCompleted, streamMessage) => {
                set(
                  makeResultsAppender({
                    resultId,
                    streamMessage,
                    isCompleted,
                  }),
                );
              },
            });
          } catch (err) {
            set(
              makeResultsAppender({
                resultId,
                isCompleted: true,
                errorMessage: {
                  error: err instanceof Error ? err.message : String(err),
                },
              }),
            );
          } finally {
            set((state) =>
              produce(state, (draft) => {
                draft.ai.isRunningAnalysis = false;
                draft.ai.analysisPrompt = '';
              }),
            );
          }
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

function findResultById(
  analysisResults: AnalysisResultSchema[],
  id: string,
): AnalysisResultSchema | undefined {
  return analysisResults.find((result) => result.id === id);
}

/**
 * Appends the tool results, tool calls, and analysis to the state
 *
 * @param resultId - The id of the result to append to
 * @param message - The message to append to the state. The structure of the message is defined as:
 * - reasoning: string The reasoning of the assistant
 * - toolCallMessages: ToolCallMessage[] The tool call messages
 * - text: string The final text message
 * @param isCompleted - Whether the analysis is completed
 * @returns The new state
 */
function makeResultsAppender<PC extends BaseRoomConfig & AiSliceConfig>({
  resultId,
  streamMessage,
  errorMessage,
  isCompleted,
}: {
  resultId: string;
  streamMessage?: StreamMessage;
  errorMessage?: ErrorMessageSchema;
  isCompleted?: boolean;
}) {
  return (state: RoomShellSliceState<PC>) =>
    produce(state, (draft) => {
      const currentSession = getCurrentSessionFromState(draft);
      if (!currentSession) {
        console.error('No current session found');
        return;
      }

      const result = findResultById(currentSession.analysisResults, resultId);
      if (result) {
        if (streamMessage && streamMessage.parts) {
          // copy all properties from streamMessage
          const newStreamMessage = {
            parts: streamMessage.parts.map((part) => {
              if (part.type === 'text') {
                return {
                  type: 'text' as const,
                  text: part.text,
                  additionalData: part.additionalData,
                  isCompleted: part.isCompleted,
                };
              } else if (part.type === 'tool-invocation') {
                return {
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    toolCallId: part.toolInvocation.toolCallId,
                    toolName: part.toolInvocation.toolName,
                    args: part.toolInvocation.args,
                    state: part.toolInvocation.state,
                    result:
                      part.toolInvocation.state === 'result'
                        ? part.toolInvocation.result
                        : undefined,
                  },
                  additionalData: part.additionalData,
                  isCompleted: part.isCompleted,
                };
              } else {
                // TODO: handle other part types later
                return part;
              }
            }),
          };

          result.streamMessage = newStreamMessage as StreamMessage;
        }
        if (errorMessage) {
          result.errorMessage = errorMessage;
        }
        if (isCompleted) {
          result.isCompleted = isCompleted;
        }
      } else {
        console.error('Result not found', resultId);
      }
    });
}

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
