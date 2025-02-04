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
      'Describe the data in the tables including the distribution of the values.',
    isRunningAnalysis: false,
    analysisResults: [],
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
    runAnalysis: async () => {
      const resultId = createId();
      const abortController = new AbortController();
      const apiKey = get().openAiApiKey;

      if (!apiKey) {
        throw new Error('OpenAI API key is required');
      }

      set({
        analysisAbortController: abortController,
        isRunningAnalysis: true,
      });
      set((state) =>
        produce(state, (draft) => {
          draft.projectConfig.analysisResults.push({
            id: resultId,
            prompt: get().analysisPrompt,
            toolResults: [],
            toolCalls: [],
          });
        }),
      );
      try {
        const {toolResults, ...rest} = await runAnalysis({
          model: get().projectConfig.aiModel,
          prompt: get().analysisPrompt,
          onStepFinish: (event) => {
            console.log('onStepFinish', event);
            set(
              addToolResults({
                resultId,
                toolResults: event.toolResults,
                toolCalls: event.toolCalls,
              }),
            );
          },
          abortSignal: abortController.signal,
          apiKey,
        });
        console.log('final result', {toolResults, ...rest});
        // set(
        //   addToolResults({
        //     resultId,
        //     toolResults,
        //     toolCalls: rest.toolCalls,
        //   }),
        // );
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

function addToolResults({
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
