import {
  useBaseRoomShellStore,
  createSlice,
  BaseRoomConfig,
  RoomShellSliceState,
  type StateCreator,
} from '@sqlrooms/room-shell';
import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {produce} from 'immer';

export function createDefaultAiSettingsConfig(
  props?: Partial<AiSettingsSliceConfig>,
): AiSettingsSliceConfig {
  return {
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
  };
}

export type AiSettingsSliceState = {
  aiSettings: {
    config: AiSettingsSliceConfig;
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
    addCustomModel: (
      baseUrl: string,
      apiKey: string,
      modelName: string,
    ) => void;
    updateCustomModel: (
      oldModelName: string,
      baseUrl: string,
      apiKey: string,
      newModelName: string,
    ) => void;
    removeCustomModel: (modelName: string) => void;
  };
};

type CreateAiSettingsSliceParams = {
  config?: Partial<AiSettingsSliceConfig>;
};

export function createAiSettingsSlice<PC extends BaseRoomConfig>(
  props?: CreateAiSettingsSliceParams,
): StateCreator<AiSettingsSliceState> {
  const config = createDefaultAiSettingsConfig(props?.config);
  return createSlice<PC, AiSettingsSliceState>((set, get) => ({
    aiSettings: {
      config,

      setMaxSteps: (maxSteps: number) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.modelParameters.maxSteps = maxSteps;
          }),
        );
      },

      setAdditionalInstruction: (additionalInstruction: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.modelParameters.additionalInstruction =
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
            if (draft.aiSettings.config.providers[provider]) {
              Object.assign(
                draft.aiSettings.config.providers[provider],
                updates,
              );
            }
          }),
        );
      },

      addProvider: (provider: string, baseUrl: string, apiKey: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.providers[provider] = {
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
            if (draft.aiSettings.config.providers[provider]) {
              // Check if model already exists
              const modelExists = draft.aiSettings.config.providers[
                provider
              ].models.some((model) => model.modelName === modelName);

              if (!modelExists) {
                draft.aiSettings.config.providers[provider].models.push({
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
            if (draft.aiSettings.config.providers[provider]) {
              draft.aiSettings.config.providers[provider].models =
                draft.aiSettings.config.providers[provider].models.filter(
                  (model) => model.modelName !== modelName,
                );
            }
          }),
        );
      },

      removeProvider: (provider: string) => {
        set((state) =>
          produce(state, (draft) => {
            delete draft.aiSettings.config.providers[provider];
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
              draft.aiSettings.config.customModels.findIndex(
                (model) =>
                  model.modelName.toLowerCase() === modelName.toLowerCase(),
              );

            if (existingModelIndex !== -1) {
              // Update existing model
              draft.aiSettings.config.customModels[existingModelIndex] =
                newCustomModel;
            } else {
              // Add new model
              draft.aiSettings.config.customModels.push(newCustomModel);
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
            const modelIndex = draft.aiSettings.config.customModels.findIndex(
              (model) => model.modelName === oldModelName,
            );

            if (modelIndex !== -1) {
              // Check if the new name conflicts with another model (excluding the current one)
              const conflictingModelIndex =
                draft.aiSettings.config.customModels.findIndex(
                  (model, index) =>
                    index !== modelIndex &&
                    model.modelName.toLowerCase() ===
                      newModelName.toLowerCase(),
                );

              if (conflictingModelIndex === -1) {
                // Update the model
                draft.aiSettings.config.customModels[modelIndex] = {
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
            draft.aiSettings.config.customModels =
              draft.aiSettings.config.customModels.filter(
                (model) => model.modelName !== modelName,
              );
          }),
        );
      },
    },
  }));
}

type RoomConfigWithAiSettings = BaseRoomConfig & AiSettingsSliceConfig;
type RoomShellSliceStateWithAiSettings =
  RoomShellSliceState<RoomConfigWithAiSettings> & AiSettingsSliceState;

// Hook to access aiSettings from the room store
export function useStoreWithAiSettings<T>(
  selector: (state: RoomShellSliceStateWithAiSettings) => T,
): T {
  return useBaseRoomShellStore<
    BaseRoomConfig & AiSettingsSliceConfig,
    RoomShellSliceState<RoomConfigWithAiSettings>,
    T
  >((state) => selector(state as unknown as RoomShellSliceStateWithAiSettings));
}
