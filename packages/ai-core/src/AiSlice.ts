import {StreamMessage} from '@openassistant/core';
import {ExtendedTool} from '@openassistant/utils';
import {createId} from '@paralleldrive/cuid2';
import type {AiSettingsSliceConfig} from '@sqlrooms/ai-settings';
import {
  BaseRoomConfig,
  createBaseSlice,
  RoomState,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {z} from 'zod';
import {runAnalysis} from './analysis';
import {
  AnalysisResultSchema,
  AnalysisSessionSchema,
  ErrorMessageSchema,
} from './schemas';

export const AiSliceConfig = z.object({
  sessions: z.array(AnalysisSessionSchema),
  currentSessionId: z.string().optional(),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(
  props?: Partial<AiSliceConfig>,
): AiSliceConfig {
  const defaultSessionId = createId();
  return {
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
  };
}

// template for the tool: Argument, LLM Result, Additional Data, Context
export type AiSliceTool = ExtendedTool<z.ZodTypeAny, unknown, unknown, unknown>;

export type AiSliceState = {
  ai: {
    config: AiSliceConfig;
    analysisPrompt: string;
    isRunningAnalysis: boolean;
    tools: Record<string, AiSliceTool>;
    analysisAbortController?: AbortController;
    setAnalysisPrompt: (prompt: string) => void;
    startAnalysis: () => Promise<void>;
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
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    findToolComponent: (toolName: string) => React.ComponentType | undefined;
    getApiKeyFromSettings: () => string;
    getBaseUrlFromSettings: () => string | undefined;
    getMaxStepsFromSettings: () => number;
    getInstructionsFromSettings: () => string;
  };
};

/**
 * Configuration options for creating an AI slice
 */
export interface AiSliceOptions {
  config?: Partial<AiSliceConfig>;
  /** Initial prompt to display in the analysis input */
  initialAnalysisPrompt?: string;
  /** Custom tools to add to the AI assistant */
  tools: Record<string, AiSliceTool>;
  /**
   * Function to get custom instructions for the AI assistant
   * @param tablesSchema - The schema of the tables in the database
   * @returns The instructions string to use
   */
  getInstructions: () => string;
  defaultProvider?: string;
  defaultModel?: string;
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
              const sessionIndex = draft.ai.config.sessions.findIndex(
                (s) => s.id === sessionId,
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

              const session = draft.ai.config.sessions.find(
                (s) => s.id === draft.ai.config.currentSessionId,
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
              modelProvider: currentSession.modelProvider || defaultProvider,
              model: currentSession.model || defaultModel,
              apiKey: get().ai.getApiKeyFromSettings(),
              baseUrl: get().ai.getBaseUrlFromSettings(),
              prompt: get().ai.analysisPrompt,
              abortController,
              tools: get().ai.tools,
              maxSteps: get().ai.getMaxStepsFromSettings(),
              getInstructions: get().ai.getInstructionsFromSettings,
              historyAnalysis: currentSession.analysisResults,
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
              const session = draft.ai.config.sessions.find(
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

        getInstructionsFromSettings: () => {
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
      },
    };
  });
}

/**
 * Helper function to type guard the store config if we have aiSettings
 * @param store
 * @returns
 */
function hasAiSettingsConfig(
  store: unknown,
): store is {aiSettings: {config: AiSettingsSliceConfig}} {
  return (
    typeof store === 'object' &&
    store !== null &&
    'aiSettings' in store &&
    store.aiSettings !== null &&
    typeof store.aiSettings === 'object' &&
    'config' in store.aiSettings
  );
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
function makeResultsAppender({
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
  return (state: AiSliceState) =>
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

export function useStoreWithAi<
  T,
  PC extends BaseRoomConfig,
  S extends RoomState<PC> & AiSliceState,
>(selector: (state: S) => T): T {
  return useBaseRoomStore<PC, RoomState<PC>, T>((state) =>
    selector(state as unknown as S),
  );
}
