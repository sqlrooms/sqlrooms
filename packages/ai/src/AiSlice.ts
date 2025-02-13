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
} from 'ai';
import {produce} from 'immer';
import {z} from 'zod';
import {runAnalysis} from './analysis';
import {
  AnalysisResultSchema,
  ToolCallSchema,
  ToolResultSchema,
} from './schemas';

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
  };
};

export function createAiSlice<PC extends BaseProjectConfig & AiSliceConfig>({
  createModel,
}: {
  createModel: (model: string) => LanguageModelV1;
}): StateCreator<AiSliceState> {
  return createSlice<PC, AiSliceState>((set, get) => ({
    ai: {
      analysisPrompt:
        'Describe the data in the table and make a chart providing an overview.',
      isRunningAnalysis: false,
      messagesById: new Map(),
      apiKey: null,

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
        set((state) =>
          produce(state, (draft) => {
            draft.ai.analysisPrompt = '';
          }),
        );
        try {
          const {toolResults, toolCalls, ...rest} = await runAnalysis({
            model: createModel(get().project.config.ai.model),
            // prompt: get().analysisPrompt,
            messages: get().ai.getMessages(),
            onStepFinish: (event) => {
              console.log('onStepFinish', event);
              get().ai.addMessages(event.response.messages);
              set(
                makeResultsAppender({
                  resultId,
                  toolResults: event.toolResults,
                  toolCalls: event.toolCalls,
                }),
              );
            },
            abortSignal: abortController.signal,
          });
          console.log('final result', {toolResults, toolCalls, ...rest});
          get().ai.addMessages([
            {
              id: createId(),
              role: 'tool',
              content: [],
              // @ts-ignore
              tool_call_id: toolCalls[toolCalls.length - 1].toolCallId,
            } satisfies AiMessage,
          ]);
          // set(
          //   makeResultsAppender({
          //     resultId,
          //     toolResults,
          //     toolCalls: rest.toolCalls,
          //   }),
          // );
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
 * @param toolResults - The new tool results
 * @param toolCalls - The new tool calls
 * @returns The new state
 */
function makeResultsAppender<PC extends BaseProjectConfig & AiSliceConfig>({
  resultId,
  toolResults,
  toolCalls,
}: {
  resultId: string;
  toolResults: ToolResultSchema[];
  toolCalls: ToolCallSchema[];
}) {
  return (state: ProjectState<PC>) =>
    produce(state, (draft) => {
      const result = findResultById(
        draft.project.config.ai.analysisResults,
        resultId,
      );
      if (result) {
        result.toolResults = [...result.toolResults, ...toolResults];
        result.toolCalls = [...result.toolCalls, ...toolCalls];
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
