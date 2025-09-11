import {
  useBaseRoomShellStore,
  createSlice,
  BaseRoomConfig,
  RoomShellSliceState,
  type StateCreator,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {z} from 'zod';

export const AiModelSliceConfig = z.object({
  aiModelConfig: z.object({
    providers: z.record(
      z.string(), // provider name
      z.object({
        baseUrl: z.string(),
        apiKey: z.string(),
        models: z.array(
          z.object({
            modelName: z.string(),
          }),
        ),
      }),
    ),
    // custom models using provider 'custom'
    customModels: z.array(
      z.object({
        baseUrl: z.string(),
        apiKey: z.string(),
        modelName: z.string(),
      }),
    ),
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
      providers: {
        openai: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          models: [
            {
              modelName: 'gpt-4.1',
            },
            {
              modelName: 'gpt-5',
            },
          ],
        },
        anthropic: {
          baseUrl: 'https://api.anthropic.com',
          apiKey: '',
          models: [
            {
              modelName: 'claude-4-sonnet',
            },
          ],
        },
      },
      customModels: [
        // {
        //   baseUrl: 'http://localhost:11434/v1',
        //   apiKey: '',
        //   modelName: 'qwen3',
        // },
      ],
      modelParameters: {
        maxSteps: 5,
        additionalInstruction: '',
      },
      ...props,
    },
  };
}

export type AiModelConfigSliceState = {
  getAiModelConfig: () => AiModelSliceConfig['aiModelConfig'];
  setMaxSteps: (maxSteps: number) => void;
  setAdditionalInstruction: (additionalInstruction: string) => void;
  updateProvider: (
    provider: string,
    updates: {
      baseUrl?: string;
      apiKey?: string;
    },
  ) => void;
  addProvider: (provider: string, baseUrl: string, apiKey: string) => void;
  addModelToProvider: (provider: string, modelName: string) => void;
  removeModelFromProvider: (provider: string, modelName: string) => void;
  removeProvider: (provider: string) => void;
  addCustomModel: (baseUrl: string, apiKey: string, modelName: string) => void;
  updateCustomModel: (
    oldModelName: string,
    baseUrl: string,
    apiKey: string,
    newModelName: string,
  ) => void;
  removeCustomModel: (modelName: string) => void;
};

export function createAiModelConfigSlice<
  PC extends BaseRoomConfig & AiModelSliceConfig,
>(): StateCreator<AiModelConfigSliceState> {
  return createSlice<PC, AiModelConfigSliceState>((set, get) => {
    return {
      getAiModelConfig: () => {
        const state = get();
        return state.config.aiModelConfig;
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

      updateProvider: (
        provider: string,
        updates: {
          baseUrl?: string;
          apiKey?: string;
        },
      ) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.config.aiModelConfig.providers[provider]) {
              Object.assign(
                draft.config.aiModelConfig.providers[provider],
                updates,
              );
            }
          }),
        );
      },

      addProvider: (provider: string, baseUrl: string, apiKey: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiModelConfig.providers[provider] = {
              baseUrl,
              apiKey,
              models: [],
            };
          }),
        );
      },

      addModelToProvider: (provider: string, modelName: string) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.config.aiModelConfig.providers[provider]) {
              // Check if model already exists
              const modelExists = draft.config.aiModelConfig.providers[
                provider
              ].models.some((model) => model.modelName === modelName);

              if (!modelExists) {
                draft.config.aiModelConfig.providers[provider].models.push({
                  modelName: modelName,
                });
              }
            }
          }),
        );
      },

      removeModelFromProvider: (provider: string, modelName: string) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.config.aiModelConfig.providers[provider]) {
              draft.config.aiModelConfig.providers[provider].models =
                draft.config.aiModelConfig.providers[provider].models.filter(
                  (model) => model.modelName !== modelName,
                );
            }
          }),
        );
      },

      removeProvider: (provider: string) => {
        set((state) =>
          produce(state, (draft) => {
            delete draft.config.aiModelConfig.providers[provider];
          }),
        );
      },

      addCustomModel: (baseUrl: string, apiKey: string, modelName: string) => {
        set((state) =>
          produce(state, (draft) => {
            const newCustomModel = {
              baseUrl,
              apiKey,
              modelName,
            };

            // Check if a custom model with the same name already exists
            const existingModelIndex =
              draft.config.aiModelConfig.customModels.findIndex(
                (model) =>
                  model.modelName.toLowerCase() === modelName.toLowerCase(),
              );

            if (existingModelIndex !== -1) {
              // Update existing model
              draft.config.aiModelConfig.customModels[existingModelIndex] =
                newCustomModel;
            } else {
              // Add new model
              draft.config.aiModelConfig.customModels.push(newCustomModel);
            }
          }),
        );
      },

      updateCustomModel: (
        oldModelName: string,
        baseUrl: string,
        apiKey: string,
        newModelName: string,
      ) => {
        set((state) =>
          produce(state, (draft) => {
            // Find the model to update
            const modelIndex =
              draft.config.aiModelConfig.customModels.findIndex(
                (model) => model.modelName === oldModelName,
              );

            if (modelIndex !== -1) {
              // Check if the new name conflicts with another model (excluding the current one)
              const conflictingModelIndex =
                draft.config.aiModelConfig.customModels.findIndex(
                  (model, index) =>
                    index !== modelIndex &&
                    model.modelName.toLowerCase() ===
                      newModelName.toLowerCase(),
                );

              if (conflictingModelIndex === -1) {
                // Update the model
                draft.config.aiModelConfig.customModels[modelIndex] = {
                  baseUrl,
                  apiKey,
                  modelName: newModelName,
                };
              }
            }
          }),
        );
      },

      removeCustomModel: (modelName: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiModelConfig.customModels =
              draft.config.aiModelConfig.customModels.filter(
                (model) => model.modelName !== modelName,
              );
          }),
        );
      },
    };
  });
}

type RoomConfigWithAiChatUi = BaseRoomConfig & AiModelSliceConfig;
type RoomShellSliceStateWithAiChatUi =
  RoomShellSliceState<RoomConfigWithAiChatUi> & AiModelConfigSliceState;

// Hook to access aiModelConfig from the room store
export function useStoreWithAiModelConfig<T>(
  selector: (state: RoomShellSliceStateWithAiChatUi) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & AiModelSliceConfig,
    RoomShellSliceState<RoomConfigWithAiChatUi>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithAiChatUi));
}
