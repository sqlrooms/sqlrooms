import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {AiSliceState} from '@sqlrooms/ai-core';
import {
  BaseRoomConfig,
  createBaseSlice,
  RoomState,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {createDefaultAiSettingsConfig} from './defaultSettings';

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
  return createBaseSlice<PC, AiSettingsSliceState>((set, get) => ({
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

type RoomStateWithAiSettings = RoomState<BaseRoomConfig> &
  AiSliceState &
  AiSettingsSliceState;

// Hook to access aiSettings from the room store
export function useStoreWithAiSettings<T>(
  selector: (state: RoomStateWithAiSettings) => T,
): T {
  return useBaseRoomStore<BaseRoomConfig, RoomState<BaseRoomConfig>, T>(
    (state) => selector(state as unknown as RoomStateWithAiSettings),
  );
}
