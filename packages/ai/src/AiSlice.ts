import {StreamMessage} from '@openassistant/core';
import {ExtendedTool} from '@openassistant/utils';
import {createId} from '@paralleldrive/cuid2';
import {DataTable} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
  useBaseRoomShellStore,
  type Slice,
  type StateCreator,
} from '@sqlrooms/room-shell';
import {produce, WritableDraft} from 'immer';
import {z} from 'zod';
import {DefaultToolsOptions, getDefaultTools, runAnalysis} from './analysis';
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
          model: 'gpt-4.1',
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

export type AiSliceState = Slice & {
  ai: {
    analysisPrompt: string;
    isRunningAnalysis: boolean;
    tools: Record<string, AiSliceTool>;
    analysisAbortController?: AbortController;
    maxSteps: number;
    setAnalysisPrompt: (prompt: string) => void;
    startAnalysis: () => Promise<void>;
    cancelAnalysis: () => void;
    setAiModel: (modelProvider: string, model: string) => void;
    setBaseUrl: (baseUrl?: string) => void;
    setMaxSteps: (maxSteps: number) => void;
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
    getMaxSteps: () => number;
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
  /**
   * Maximum number of analysis steps allowed (default: 5)
   */
  getMaxSteps?: () => number;
  /**
   * Base URL for the AI model, no need to provide unless proxy or ollama
   */
  getBaseUrl?: () => string | undefined;
  /**
   * Get the API key for the AI model
   */
  getApiKey?: (modelProvider: string) => string;
  /**
   * Default model to use if no model is provided
   */
  defaultModel?: string;
}

export function createAiSlice<PC extends BaseRoomConfig & AiSliceConfig>(
  params: AiSliceOptions,
): StateCreator<AiSliceState> {
  const {
    getApiKey,
    getBaseUrl,
    initialAnalysisPrompt = '',
    customTools = {},
    getInstructions,
    toolsOptions,
    getMaxSteps,
    defaultModel = 'gpt-4.1',
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
         * Set the base URL for the current session
         * @param baseUrl - The server URL to set
         */
        setBaseUrl: (baseUrl?: string) => {
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
         * Set the maximum number of analysis steps
         * @param maxSteps - The maximum number of steps to set
         */
        setMaxSteps: (maxSteps: number) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.maxSteps = maxSteps;
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
              apiKey:
                getApiKey?.(currentSession.modelProvider || 'openai') || '',
              baseUrl: getBaseUrl?.() || currentSession.baseUrl,
              prompt: get().ai.analysisPrompt,
              abortController,
              tools: get().ai.tools,
              maxSteps: getMaxSteps?.() || get().ai.maxSteps || 50,
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

        getMaxSteps: () => {
          return get().ai.maxSteps;
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
