import {createId} from '@paralleldrive/cuid2';
import {
  createProjectSlice,
  ProjectState,
  useBaseProjectStore,
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
    supportedModels: string[];
    analysisPrompt: string;
    isRunningAnalysis: boolean;
    analysisAbortController?: AbortController;
    apiKey: string | null;
    setAiModel: (model: string) => void;
    setAnalysisPrompt: (prompt: string) => void;
    setApiKey: (key: string) => void;
    startAnalysis: () => Promise<void>;
    cancelAnalysis: () => void;
    messagesById: Map<string, AiMessage>;
    addMessages: (messages: AiMessage[]) => void;
    getMessages: () => AiMessage[];
  };
};

export function createAiSlice<PC extends BaseProjectConfig & AiSliceConfig>({
  supportedModels,
  createModel,
}: {
  supportedModels: string[];
  createModel: (model: string, apiKey: string) => LanguageModelV1;
}) {
  return createProjectSlice<PC, AiSliceState>((set, get) => ({
    ai: {
      supportedModels,
      analysisPrompt:
        'Describe the data in the table and make a chart providing an overview.',
      isRunningAnalysis: false,
      messagesById: new Map(),
      apiKey:
        typeof window !== 'undefined'
          ? localStorage.getItem('ai_api_key')
          : null,
      setApiKey: (key: string) => {
        localStorage.setItem('ai_api_key', key);
        set((state) =>
          produce(state, (draft) => {
            draft.ai.apiKey = key;
          }),
        );
      },
      setAnalysisPrompt: (prompt: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.ai.analysisPrompt = prompt;
          }),
        );
      },

      setAiModel: (model: string) => {
        set({projectConfig: {...get().projectConfig, model: model}});
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
        const {apiKey} = get().ai;
        const model = get().projectConfig.ai.model;

        if (!apiKey) {
          throw new Error('OpenAI API key is required');
        }

        set((state) =>
          produce(state, (draft) => {
            draft.ai.analysisAbortController = abortController;
            draft.ai.isRunningAnalysis = true;
            draft.projectConfig.ai.analysisResults.push({
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
            model: createModel(model, apiKey),
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
            apiKey,
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
        draft.projectConfig.ai.analysisResults,
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
