import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  ProjectState,
  useBaseProjectStore,
  type StateCreator,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {produce, WritableDraft} from 'immer';
import {z} from 'zod';
import {runAnalysis} from './analysis';
import {
  AnalysisResultSchema,
  AnalysisSessionSchema,
  ErrorMessageSchema,
} from './schemas';
import {StreamMessage} from '@openassistant/core';

export const AiSliceConfig = z.object({
  ai: z.object({
    sessions: z.array(AnalysisSessionSchema),
    currentSessionId: z.string().optional(),
  }),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(): AiSliceConfig {
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
    },
  };
}

export type AiSliceState = {
  ai: {
    analysisPrompt: string;
    isRunningAnalysis: boolean;
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
  };
};

/**
 * Execute the analysis. It will be used by the action `startAnalysis`.
 *
 * Each analysis contains an array of toolCalls and the results of the tool calls (toolResults).
 * After all the tool calls have been executed, the LLM will stream the results as text stored in `analysis`.
 *
 * @param resultId - The result id
 * @param prompt - The prompt
 * @param model - The model
 * @param apiKey - The api key
 * @param abortController - The abort controller
 * @param addMessages - The add messages function
 * @param set - The set function
 */
async function executeAnalysis({
  resultId,
  prompt,
  modelProvider,
  model,
  apiKey,
  abortController,
  set,
}: {
  resultId: string;
  prompt: string;
  modelProvider: string;
  model: string;
  apiKey: string;
  abortController: AbortController;
  set: <T>(fn: (state: T) => T) => void;
}) {
  try {
    await runAnalysis({
      modelProvider,
      model,
      apiKey,
      prompt,
      abortController,
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
  }
}

export function createAiSlice<PC extends BaseProjectConfig & AiSliceConfig>({
  getApiKey,
  initialAnalysisPrompt = '',
}: {
  getApiKey: (modelProvider: string) => string;
  initialAnalysisPrompt?: string;
}): StateCreator<AiSliceState> {
  return createSlice<PC, AiSliceState>((set, get) => ({
    ai: {
      analysisPrompt: initialAnalysisPrompt,
      isRunningAnalysis: false,

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
              model: model || currentSession?.model || 'gpt-4o-mini',
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
                  toolCallMessages: [],
                  reasoning: '',
                  text: '',
                },
                isCompleted: false,
              });
            }
          }),
        );

        try {
          await executeAnalysis({
            resultId,
            prompt: get().ai.analysisPrompt,
            modelProvider: currentSession.modelProvider || 'openai',
            model: currentSession.model || 'gpt-4o-mini',
            apiKey: getApiKey(currentSession.modelProvider || 'openai'),
            abortController,
            set,
          });
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
    },
  }));
}

/**
 * Helper function to get the current session from state
 */
function getCurrentSessionFromState<
  PC extends BaseProjectConfig & AiSliceConfig,
>(
  state: ProjectState<PC> | WritableDraft<ProjectState<PC>>,
): AnalysisSessionSchema | undefined {
  const {currentSessionId, sessions} = state.config.ai;
  return sessions.find(
    (session: AnalysisSessionSchema) => session.id === currentSessionId,
  );
}

function findResultById(analysisResults: AnalysisResultSchema[], id: string) {
  return analysisResults.find((r: AnalysisResultSchema) => r.id === id);
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
function makeResultsAppender<PC extends BaseProjectConfig & AiSliceConfig>({
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
  return (state: ProjectState<PC>) =>
    produce(state, (draft) => {
      const currentSession = getCurrentSessionFromState(draft);
      if (!currentSession) {
        console.error('No current session found');
        return;
      }

      const result = findResultById(currentSession.analysisResults, resultId);
      if (result) {
        if (streamMessage) {
          result.streamMessage = {
            toolCallMessages: (streamMessage.toolCallMessages || []).map(
              (toolCall) => ({
                args: {...toolCall.args},
                isCompleted: toolCall.isCompleted,
                llmResult: toolCall.llmResult,
                additionalData: toolCall.additionalData,
                text: toolCall.text,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
              }),
            ),
            reasoning: streamMessage.reasoning,
            text: streamMessage.text,
            analysis: streamMessage.analysis,
            parts: streamMessage.parts?.map((part) => ({
              ...part,
              ...(part.type === 'text' && {text: part.text}),
              ...(part.type === 'tool' && {
                toolCallMessages: part.toolCallMessages?.map((toolCall) => ({
                  args: {...toolCall.args},
                  isCompleted: toolCall.isCompleted,
                  llmResult: toolCall.llmResult,
                  additionalData: toolCall.additionalData,
                  text: toolCall.text,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                })),
              }),
            })),
          };
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

type ProjectConfigWithAi = BaseProjectConfig & AiSliceConfig;
type ProjectStateWithAi = ProjectState<ProjectConfigWithAi> & AiSliceState;

export function useStoreWithAi<T>(
  selector: (state: ProjectStateWithAi) => T,
): T {
  return useBaseProjectStore<
    BaseProjectConfig & AiSliceConfig,
    ProjectState<ProjectConfigWithAi>,
    T
  >((state) => selector(state as unknown as ProjectStateWithAi));
}
