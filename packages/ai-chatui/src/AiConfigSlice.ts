import {StateCreator} from 'zustand';
import {
  useBaseRoomShellStore,
  createSlice,
  BaseRoomConfig,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {z} from 'zod';

export const AiChatUiSliceConfig = z.object({
  aiChatUi: z.object({
    type: z.enum(['default', 'custom']),
    models: z.array(
      z.object({
        id: z.string(),
        model: z.string(),
        provider: z.string(),
        apiKey: z.string().optional(),
      }),
    ),
    selectedModelId: z.string().optional(),
    customModel: z.object({
      baseUrl: z.string(),
      apiKey: z.string(),
      modelName: z.string(),
    }),
    modelParameters: z.object({
      maxSteps: z.number(),
      additionalInstruction: z.string(),
    }),
  }),
});
export type AiChatUiSliceConfig = z.infer<typeof AiChatUiSliceConfig>;

export function createDefaultAiChatUiConfig(
  props: Partial<AiChatUiSliceConfig['aiChatUi']>,
): AiChatUiSliceConfig {
  const defaultModelId = 'default-gpt-4o-mini';
  return {
    aiChatUi: {
      type: 'default',
      models: [
        {
          id: defaultModelId,
          model: 'gpt-4o-mini',
          provider: 'openai',
          apiKey: '',
        },
        {
          id: 'default-gpt-4',
          model: 'gpt-4',
          provider: 'openai',
          apiKey: '',
        },
        {
          id: 'default-claude-3-sonnet',
          model: 'claude-3-sonnet-20240229',
          provider: 'anthropic',
          apiKey: '',
        },
      ],
      selectedModelId: defaultModelId,
      customModel: {
        baseUrl: '',
        apiKey: '',
        modelName: '',
      },
      modelParameters: {
        maxSteps: 5,
        additionalInstruction: '',
      },
      ...props,
    },
  };
}

export type AiChatUiSliceState = {
  getAiConfig: () => {
    type: 'default' | 'custom';
    models: Array<{
      id: string;
      model: string;
      provider: string;
      apiKey?: string;
    }>;
    selectedModelId?: string;
    customModel: {
      baseUrl: string;
      apiKey: string;
      modelName: string;
    };
    modelParameters: {
      maxSteps: number;
      additionalInstruction: string;
    };
  };
  getSelectedModel: () => {
    id: string;
    model: string;
    provider: string;
    apiKey?: string;
  } | null;
  setAiConfigType: (type: 'default' | 'custom') => void;
  addModel: (model: string, provider: string, apiKey?: string) => string;
  updateModel: (
    id: string,
    updates: {
      model?: string;
      provider?: string;
      apiKey?: string;
    },
  ) => void;
  removeModel: (id: string) => void;
  setSelectedModel: (id: string) => void;
  setCustomModel: (baseUrl: string, apiKey: string, modelName: string) => void;
  setModelParameters: (parameters: {
    maxSteps?: number;
    additionalInstruction?: string;
  }) => void;
  setMaxSteps: (maxSteps: number) => void;
  setAdditionalInstruction: (additionalInstruction: string) => void;
};

export function createAiChatUiSlice<
  PC extends BaseRoomConfig & AiChatUiSliceConfig,
>(): StateCreator<AiChatUiSliceState> {
  return createSlice<PC, AiChatUiSliceState>((set, get) => {
    return {
      getAiConfig: () => {
        const state = get();
        return state.config.aiChatUi;
      },

      getSelectedModel: () => {
        const state = get();
        const {models, selectedModelId} = state.config.aiChatUi;
        if (!selectedModelId) return null;
        return models.find((model) => model.id === selectedModelId) || null;
      },

      setAiConfigType: (type: 'default' | 'custom') => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiChatUi.type = type;
          }),
        );
      },

      addModel: (model: string, provider: string, apiKey?: string) => {
        const id = `${provider}-${model}-${Date.now()}`;
        const newModel = {id, model, provider, apiKey};
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiChatUi.models.push(newModel);
            // If this is the first model, select it
            if (draft.config.aiChatUi.models.length === 1) {
              draft.config.aiChatUi.selectedModelId = id;
            }
          }),
        );
        return id;
      },

      updateModel: (
        id: string,
        updates: {
          model?: string;
          provider?: string;
          apiKey?: string;
        },
      ) => {
        set((state) =>
          produce(state, (draft) => {
            const modelIndex = draft.config.aiChatUi.models.findIndex(
              (model) => model.id === id,
            );
            if (modelIndex !== -1) {
              const model = draft.config.aiChatUi.models[modelIndex];
              if (model) {
                Object.assign(model, updates);
              }
            }
          }),
        );
      },

      removeModel: (id: string) => {
        set((state) =>
          produce(state, (draft) => {
            const modelIndex = draft.config.aiChatUi.models.findIndex(
              (model) => model.id === id,
            );
            if (modelIndex !== -1) {
              draft.config.aiChatUi.models.splice(modelIndex, 1);
              // If we removed the selected model, select the first available one
              if (draft.config.aiChatUi.selectedModelId === id) {
                draft.config.aiChatUi.selectedModelId =
                  draft.config.aiChatUi.models.length > 0
                    ? draft.config.aiChatUi.models[0]?.id
                    : undefined;
              }
            }
          }),
        );
      },

      setSelectedModel: (id: string) => {
        set((state) =>
          produce(state, (draft) => {
            const modelExists = draft.config.aiChatUi.models.some(
              (model) => model.id === id,
            );
            if (modelExists) {
              draft.config.aiChatUi.selectedModelId = id;
            }
          }),
        );
      },

      setCustomModel: (baseUrl: string, apiKey: string, modelName: string) => {
        const newCustomModel = {baseUrl, apiKey, modelName};
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiChatUi.customModel = newCustomModel;
          }),
        );
      },

      setModelParameters: (parameters: {
        maxSteps?: number;
        additionalInstruction?: string;
      }) => {
        set((state) =>
          produce(state, (draft) => {
            const newParameters = {
              ...draft.config.aiChatUi.modelParameters,
              ...parameters,
            };
            draft.config.aiChatUi.modelParameters = newParameters;
          }),
        );
      },

      setMaxSteps: (maxSteps: number) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiChatUi.modelParameters.maxSteps = maxSteps;
          }),
        );
      },

      setAdditionalInstruction: (additionalInstruction: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiChatUi.modelParameters.additionalInstruction =
              additionalInstruction;
          }),
        );
      },
    };
  });
}

type RoomConfigWithAiChatUi = BaseRoomConfig & AiChatUiSliceConfig;
type RoomShellSliceStateWithAiChatUi =
  RoomShellSliceState<RoomConfigWithAiChatUi> & AiChatUiSliceState;

// Hook to access aiChatUi from the room store
export function useStoreWithAiChatUi<T>(
  selector: (state: RoomShellSliceStateWithAiChatUi) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & AiChatUiSliceConfig,
    RoomShellSliceState<RoomConfigWithAiChatUi>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithAiChatUi));
}
