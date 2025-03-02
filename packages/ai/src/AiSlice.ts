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
  StepResult,
  ToolSet,
} from 'ai';
import {produce} from 'immer';
import {z} from 'zod';
import {runAnalysis} from './analysis';
import {
  AnalysisResultSchema,
  ElementSchema,
  ToolCallSchema,
  ToolResultSchema,
} from './schemas';
import {ToolCallMessage} from '@openassistant/core';
import React from 'react';

// Define a serializable version of ToolCallMessage for our local use
// This ensures compatibility with the external ToolCallMessage type
// while allowing us to use serializable data
type SerializableToolCallMessage = {
  toolCallId: string;
  element: ElementSchema;
};

type AiMessage = (CoreToolMessage | CoreAssistantMessage | CoreUserMessage) & {
  id: string;
};

export const AiSliceConfig = z.object({
  ai: z.object({
    modelProvider: z.string(),
    model: z.string(),
    analysisResults: z.array(AnalysisResultSchema),
  }),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(): AiSliceConfig {
  return {
    ai: {
      modelProvider: 'openai',
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
  addMessages,
  set,
}: {
  resultId: string;
  prompt: string;
  modelProvider: string;
  model: string;
  apiKey: string;
  abortController: AbortController;
  addMessages: (messages: AiMessage[]) => void;
  set: <T>(fn: (state: T) => T) => void;
}) {
  try {
    await runAnalysis({
      modelProvider,
      model,
      apiKey,
      prompt,
      abortController,
      onStepFinish: (
        event: StepResult<ToolSet>,
        toolCallMessages: ToolCallMessage[],
      ) => {
        addMessages(event.response.messages);

        // No need for custom serialization logic since queryMessage now returns serializable data
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
        isCompleted: true,
        toolResults: [
          {
            toolName: 'error',
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
  }
}

export function createAiSlice<PC extends BaseProjectConfig & AiSliceConfig>({
  getApiKey,
  initialAnalysisPrompt = 'Describe the data in the tables and make a chart providing an overview of the most important features.',
}: {
  getApiKey: () => string;
  initialAnalysisPrompt?: string;
}): StateCreator<AiSliceState> {
  return createSlice<PC, AiSliceState>((set, get) => ({
    ai: {
      analysisPrompt: initialAnalysisPrompt,
      isRunningAnalysis: false,
      messagesById: new Map(),

      setAnalysisPrompt: (prompt: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.ai.analysisPrompt = prompt;
          }),
        );
      },

      /**
       * Set the AI model
       * @param model - The model to set
       */
      setAiModel: (model: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.ai.model = model;
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
            draft.config.ai.analysisResults.push({
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
          await executeAnalysis({
            resultId,
            prompt: get().ai.analysisPrompt,
            modelProvider: get().config.ai.modelProvider,
            model: get().config.ai.model,
            apiKey: getApiKey(),
            abortController,
            addMessages: get().ai.addMessages,
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
    },
  }));
}

function findResultById(analysisResults: AnalysisResultSchema[], id: string) {
  return analysisResults.find((r: AnalysisResultSchema) => r.id === id);
}

/**
 * Appends the tool results, tool calls, and analysis to the state
 *
 * @param resultId - The id of the result to append to
 * @param toolCalls - The tool calls that were executed by the LLM, e.g. "query" or "chart" ("map" will be added soon). See {@link ToolCallSchema} for more details.
 * @param toolResults - The results of the tool calls that were executed by the LLM. See {@link ToolResultSchema} for more details.
 * @param toolCallMessages - The tool call messages that were created by some of our defined TOOLS, e.g. the table with query result. These should now be serializable objects linked to tool calls by toolCallId.
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
      const result = findResultById(draft.config.ai.analysisResults, resultId);
      if (result) {
        if (toolResults) {
          result.toolResults = [...result.toolResults, ...toolResults];
        }
        if (toolCalls) {
          result.toolCalls = [...result.toolCalls, ...toolCalls];
        }
        if (toolCallMessages) {
          // Cast to the correct type for schema compatibility
          const serializableMessages =
            toolCallMessages as unknown as SerializableToolCallMessage[];
          result.toolCallMessages = [
            ...result.toolCallMessages,
            ...serializableMessages,
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
