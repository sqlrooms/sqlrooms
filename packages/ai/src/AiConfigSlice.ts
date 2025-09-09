import {
  useBaseRoomShellStore,
  createSlice,
  BaseRoomConfig,
  RoomShellSliceState,
  type StateCreator,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {z} from 'zod';
import {getSelectedModel} from './utils';

export const AiModelSliceConfig = z.object({
  aiModelConfig: z.object({
    type: z.enum(['default', 'custom']),
    models: z.record(
      z.string(),
      z.object({
        provider: z.string(),
        baseUrl: z.string(),
        apiKey: z.string(),
        models: z.array(
          z.object({
            id: z.string(),
            modelName: z.string(),
          }),
        ),
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
export type AiModelSliceConfig = z.infer<typeof AiModelSliceConfig>;

export function createDefaultAiModelConfig(
  props: Partial<AiModelSliceConfig['aiModelConfig']>,
): AiModelSliceConfig {
  return {
    aiModelConfig: {
      type: 'default',
      models: {
        openai: {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          models: [
            {
              id: 'gpt-4.1',
              modelName: 'gpt-4.1',
            },
          ],
        },
      },
      selectedModelId: 'gpt-4.1',
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
  getAiConfig: () => AiModelSliceConfig['aiModelConfig'];
  getSelectedModel: () => {
    id: string;
    modelName: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
  } | null;
  setAiConfigType: (type: 'default' | 'custom') => void;
  setSelectedModel: (id: string) => void;
  setCustomModel: (baseUrl: string, apiKey: string, modelName: string) => void;
  setMaxSteps: (maxSteps: number) => void;
  setAdditionalInstruction: (additionalInstruction: string) => void;
  setModelProviderApiKey: (provider: string, apiKey: string) => void;
  updateProvider: (
    provider: string,
    updates: {
      baseUrl?: string;
      apiKey?: string;
    },
  ) => void;
};

export function createAiModelConfigSlice<
  PC extends BaseRoomConfig & AiModelSliceConfig,
>(): StateCreator<AiChatUiSliceState> {
  return createSlice<PC, AiChatUiSliceState>((set, get) => {
    return {
      getAiConfig: () => {
        const state = get();
        return state.config.aiModelConfig;
      },

      getSelectedModel: () => {
        const state = get();
        return getSelectedModel(state.config.aiModelConfig);
      },

      setAiConfigType: (type: 'default' | 'custom') => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiModelConfig.type = type;
          }),
        );
      },

      setSelectedModel: (id: string) => {
        set((state) =>
          produce(state, (draft) => {
            // Check if model exists across all providers
            const modelExists = Object.values(
              draft.config.aiModelConfig.models,
            ).some((provider) =>
              provider.models.some((model) => model.id === id),
            );
            if (modelExists) {
              draft.config.aiModelConfig.selectedModelId = id;
            }
          }),
        );
      },

      setCustomModel: (baseUrl: string, apiKey: string, modelName: string) => {
        const newCustomModel = {baseUrl, apiKey, modelName};
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiModelConfig.customModel = newCustomModel;
          }),
        );
      },

      setMaxSteps: (maxSteps: number) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiModelConfig.modelParameters.maxSteps = maxSteps;
          }),
        );
      },

      setAdditionalInstruction: (additionalInstruction: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiModelConfig.modelParameters.additionalInstruction =
              additionalInstruction;
          }),
        );
      },

      setModelProviderApiKey: (provider: string, apiKey: string) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.config.aiModelConfig.models[provider]) {
              draft.config.aiModelConfig.models[provider].apiKey = apiKey;
            }
          }),
        );
      },

      updateProvider: (
        provider: string,
        updates: {
          baseUrl?: string;
          apiKey?: string;
        },
      ) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.config.aiModelConfig.models[provider]) {
              Object.assign(
                draft.config.aiModelConfig.models[provider],
                updates,
              );
            }
          }),
        );
      },
    };
  });
}

type RoomConfigWithAiChatUi = BaseRoomConfig & AiModelSliceConfig;
type RoomShellSliceStateWithAiChatUi =
  RoomShellSliceState<RoomConfigWithAiChatUi> & AiChatUiSliceState;

// Hook to access aiModelConfig from the room store
export function useStoreWithAiChatUi<T>(
  selector: (state: RoomShellSliceStateWithAiChatUi) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & AiModelSliceConfig,
    RoomShellSliceState<RoomConfigWithAiChatUi>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithAiChatUi));
}
