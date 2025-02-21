import {createId} from '@paralleldrive/cuid2';
import {
  createSlice,
  ProjectState,
  useBaseProjectStore,
  type StateCreator,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {
  CoreAssistantMessage,
  CoreToolMessage,
  CoreUserMessage,
  LanguageModelV1,
  StepResult,
  ToolSet,
} from 'ai';
import {produce} from 'immer';
import {z} from 'zod';
import {runAnalysis} from './analysis';
import {
  AnalysisResultSchema,
  ToolCallSchema,
  ToolResultSchema,
} from './schemas';
import {ToolCallMessage} from '@openassistant/core';
type AiMessage = (CoreToolMessage | CoreAssistantMessage | CoreUserMessage) & {
  id: string;
};

export const AiSliceConfig = z.object({
  ai: z.object({
    model: z.string(),
    analysisResults: z.array(AnalysisResultSchema),
  }),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(): AiSliceConfig {
  return {
    ai: {
      model: 'gpt-4o-mini',
      analysisResults: [],
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
    messagesById: Map<string, AiMessage>;
    addMessages: (messages: AiMessage[]) => void;
    getMessages: () => AiMessage[];
    setAiModel: (model: string) => void;
    tableSchema: string;
  };
};

export function createAiSlice<PC extends BaseProjectConfig & AiSliceConfig>({
  createModel,
  getApiKey,
}: {
  createModel: (model: string) => LanguageModelV1;
  getApiKey: () => string;
}): StateCreator<AiSliceState> {
  return createSlice<PC, AiSliceState>((set, get) => ({
    ai: {
      analysisPrompt:
        'Describe the data in the table and make a chart providing an overview.',
      isRunningAnalysis: false,
      messagesById: new Map(),
      tableSchema: '',

      setAnalysisPrompt: (prompt: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.ai.analysisPrompt = prompt;
          }),
        );
      },

      setAiModel: (model: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.project.config.ai.model = model;
          }),
        );
      },

      /**
       * Add messages to the project store uniquely by id
       * @param messages - The messages to add.
       */
      addMessages: (messages: AiMessage[]) => {
        set((state) => {
          const newMessages = messages.filter(
            (m) => !state.ai.messagesById.has(m.id),
          );
          const newMessagesById = new Map(state.ai.messagesById);
          for (const m of newMessages) {
            if (!m.id) {
              console.warn('Message has no id', m);
            }
            newMessagesById.set(m.id, m);
          }
          console.log('newMessagesById', Array.from(newMessagesById.values()));
          return {
            ai: {
              ...state.ai,
              messagesById: newMessagesById,
            },
          };
        });
      },

      getMessages: () => {
        return Array.from(get().ai.messagesById.values());
      },

      startAnalysis: async () => {
        const resultId = createId();
        const abortController = new AbortController();
        set((state) =>
          produce(state, (draft) => {
            draft.ai.analysisAbortController = abortController;
            draft.ai.isRunningAnalysis = true;
            draft.project.config.ai.analysisResults.push({
              id: resultId,
              prompt: get().ai.analysisPrompt,
              toolResults: [],
              toolCalls: [],
              toolCallMessages: [],
              analysis: '',
              isCompleted: false,
            });
          }),
        );
        get().ai.addMessages([
          {
            id: createId(),
            role: 'user',
            content: get().ai.analysisPrompt,
          },
        ]);

        try {
          await runAnalysis({
            model: createModel(get().project.config.ai.model),
            apiKey: getApiKey(),
            tableSchema: get().ai.tableSchema,
            prompt: get().ai.analysisPrompt,
            abortSignal: abortController.signal,
            onStepFinish: (
              event: StepResult<ToolSet>,
              toolCallMessages: ToolCallMessage[],
            ) => {
              get().ai.addMessages(event.response.messages);
              set(
                makeResultsAppender({
                  resultId,
                  toolResults: event.toolResults,
                  toolCalls: event.toolCalls,
                  toolCallMessages,
                }),
              );
            },
            onStreamResult: (message, isCompleted) => {
              set(
                makeResultsAppender({
                  resultId,
                  analysis: message,
                  isCompleted,
                }),
              );
            },
          });
        } catch (err) {
          set(
            makeResultsAppender({
              resultId,
              toolResults: [
                {
                  toolName: 'answer',
                  toolCallId: createId(),
                  args: {},
                  result: {
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                  },
                },
              ],
              toolCalls: [],
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
    },
  }));
}

function findResultById(analysisResults: AnalysisResultSchema[], id: string) {
  return analysisResults.find((r: AnalysisResultSchema) => r.id === id);
}

/**
 * Returns a function that will update the state by appending new results
 * to the analysis results.
 * @param resultId - The result id
 * @param toolCalls - The tool calls that were executed by the LLM, e.g. "query" or "chart" ("map" will be added soon)
 * @param toolCallMessages - The tool call messages that were created by some of our defined TOOLS, e.g. the table with query result. It's an array of React/JSX elements. toolCallId is used to link the message to the tool call.
 * @param toolResults - The new tool results. TODO: remove this, we don't need this since the tool results are the content sent back to LLM as a response, so there is no need to use them in analysis
 * @param analysis - The analysis is the content generated after all the tool calls have been executed
 * @param isCompleted - Whether the analysis is completed
 * @returns The new state
 */
function makeResultsAppender<PC extends BaseProjectConfig & AiSliceConfig>({
  resultId,
  toolResults,
  toolCalls,
  analysis,
  isCompleted,
  toolCallMessages,
}: {
  resultId: string;
  toolResults?: ToolResultSchema[];
  toolCalls?: ToolCallSchema[];
  analysis?: string;
  isCompleted?: boolean;
  toolCallMessages?: ToolCallMessage[];
}) {
  return (state: ProjectState<PC>) =>
    produce(state, (draft) => {
      const result = findResultById(
        draft.project.config.ai.analysisResults,
        resultId,
      );
      if (result) {
        if (toolResults) {
          result.toolResults = [...result.toolResults, ...toolResults];
        }
        if (toolCalls) {
          result.toolCalls = [...result.toolCalls, ...toolCalls];
        }
        if (toolCallMessages) {
          result.toolCallMessages = [
            ...result.toolCallMessages,
            ...toolCallMessages,
          ];
        }
        if (analysis) {
          result.analysis = analysis;
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
