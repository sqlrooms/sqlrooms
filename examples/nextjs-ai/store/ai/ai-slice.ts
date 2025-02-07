import {createId} from '@paralleldrive/cuid2';
import {createProjectSlice, ProjectState} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {CoreAssistantMessage, CoreToolMessage, CoreUserMessage} from 'ai';
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
  aiModel: z.string(),
  analysisResults: z.array(AnalysisResultSchema),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(): AiSliceConfig {
  return {
    aiModel: 'gpt-4o-mini',
    analysisResults: [],
  };
}

export function createAiSlice<PC extends BaseProjectConfig & AiSliceConfig>() {
  return createProjectSlice<
    PC,
    {
      analysisPrompt: string;
      isRunningAnalysis: boolean;
      analysisAbortController?: AbortController;
      openAiApiKey: string | null;
      setAiModel: (model: string) => void;
      setAnalysisPrompt: (prompt: string) => void;
      setOpenAiApiKey: (key: string) => void;
      runAnalysis: () => Promise<void>;
      cancelAnalysis: () => void;
      messagesById: Map<string, AiMessage>;
      addMessages: (messages: AiMessage[]) => void;
      getMessages: () => AiMessage[];
    }
  >((set, get) => ({
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
    addMessages: (messages: AiMessage[]) => {
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
        set({isRunningAnalysis: false});
      }
    },
    cancelAnalysis: () => {
      set({isRunningAnalysis: false});
      get().analysisAbortController?.abort('Analysis cancelled');
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
