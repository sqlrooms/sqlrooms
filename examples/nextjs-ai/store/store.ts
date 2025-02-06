import {createId} from '@paralleldrive/cuid2';
import {
  createProjectSlice,
  ProjectState,
  useBaseProjectStore,
} from '@sqlrooms/project-builder';
import {produce} from 'immer';
import {createStore} from 'zustand';
import {runAnalysis} from './ai/analysis';
import {
  AnalysisResultSchema,
  ToolCallSchema,
  ToolResultSchema,
} from './ai/schemas';
import {DemoProjectConfig} from './demo-project-config';
import {INITIAL_PROJECT_STATE} from './initial-project-state';
import {CoreToolMessage} from 'ai';

// TODO: use the correct type
type Message = any;

/**
 * Project state with custom fields and methods
 */
export type DemoProjectState = ProjectState<DemoProjectConfig> & {
  analysisPrompt: string;
  isRunningAnalysis: boolean;
  analysisAbortController?: AbortController;
  openAiApiKey: string | null;
  setAiModel: (model: string) => void;
  setAnalysisPrompt: (prompt: string) => void;
  setOpenAiApiKey: (key: string) => void;
  runAnalysis: () => Promise<void>;
  cancelAnalysis: () => void;
  messagesById: Map<string, Message>;
  addMessages: (messages: Message[]) => void;
  getMessages: () => Message[];
};

/**
 * Create a customized project store
 */
export const createDemoProjectStore = () =>
  createStore<DemoProjectState>()((set, get, store) => ({
    ...createProjectSlice<DemoProjectConfig>(INITIAL_PROJECT_STATE)(
      set,
      get,
      store,
    ),
    analysisPrompt:
      'Describe the data in the table and make a chart providing an overview.',
    isRunningAnalysis: false,
    analysisResults: [],
    messagesById: new Map(),
    openAiApiKey:
      typeof window !== 'undefined'
        ? localStorage.getItem('openai_api_key')
        : null,
    setOpenAiApiKey: (key: string) => {
      localStorage.setItem('openai_api_key', key);
      set({openAiApiKey: key});
    },
    setAnalysisPrompt: (prompt: string) => {
      set({analysisPrompt: prompt});
    },
    setAiModel: (model: string) => {
      set({projectConfig: {...get().projectConfig, aiModel: model}});
    },

    /**
     * Add messages to the project store uniquely by id
     * @param messages - The messages to add.
     */
    addMessages: (messages: Message[]) => {
      set((state) => {
        const newMessages = messages.filter(
          (m) => !state.messagesById.has(m.id),
        );
        const newMessagesById = new Map(state.messagesById);
        for (const m of newMessages) {
          if (!m.id) {
            console.warn('Message has no id', m);
          }
          newMessagesById.set(m.id, m);
        }
        console.log('newMessagesById', Array.from(newMessagesById.values()));
        return {
          messagesById: newMessagesById,
        };
      });
    },
    getMessages: () => {
      return Array.from(get().messagesById.values());
    },
    runAnalysis: async () => {
      const resultId = createId();
      const abortController = new AbortController();
      const apiKey = get().openAiApiKey;

      if (!apiKey) {
        throw new Error('OpenAI API key is required');
      }

      set((state) =>
        produce(state, (draft) => {
          draft.analysisAbortController = abortController;
          draft.isRunningAnalysis = true;
          draft.projectConfig.analysisResults.push({
            id: resultId,
            prompt: get().analysisPrompt,
            toolResults: [],
            toolCalls: [],
          });
        }),
      );
      get().addMessages([
        {
          id: createId(),
          role: 'user',
          content: get().analysisPrompt,
        },
      ]);
      set({analysisPrompt: ''});
      try {
        const {toolResults, toolCalls, ...rest} = await runAnalysis({
          model: get().projectConfig.aiModel,
          // prompt: get().analysisPrompt,
          messages: get().getMessages(),
          onStepFinish: (event) => {
            console.log('onStepFinish', event);
            get().addMessages(event.response.messages);
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
        get().addMessages([
          {
            // @ts-ignore
            id: createId(),
            role: 'tool',
            content: [],
            tool_call_id: toolCalls[toolCalls.length - 1].toolCallId,
          } satisfies CoreToolMessage,
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
        set({isRunningAnalysis: false});
      }
    },
    cancelAnalysis: () => {
      set({isRunningAnalysis: false});
      get().analysisAbortController?.abort('Analysis cancelled');
    },
  }));

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
function makeResultsAppender({
  resultId,
  toolResults,
  toolCalls,
}: {
  resultId: string;
  toolResults: ToolResultSchema[];
  toolCalls: ToolCallSchema[];
}) {
  return (state: DemoProjectState) =>
    produce(state, (draft) => {
      const result = findResultById(
        draft.projectConfig.analysisResults,
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

/**
 * Hook for accessing the project store with custom fields and methods
 */
export function useProjectStore<T>(
  selector: (state: DemoProjectState) => T,
): T {
  return useBaseProjectStore(
    selector as (state: ProjectState<DemoProjectConfig>) => T,
  );
}
