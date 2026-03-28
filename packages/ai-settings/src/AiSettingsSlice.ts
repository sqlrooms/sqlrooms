import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {AiSliceState} from '@sqlrooms/ai-core';
import {
  createSlice,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {createDefaultAiSettingsConfig} from './defaultSettings';

export type AiSettingsSliceState = {
  aiSettings: {
    config: AiSettingsSliceConfig;
    isSaving: boolean;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
    lastSaveError: string | null;
    setConfig: (config: AiSettingsSliceConfig) => void;
    setDefaultProvider: (provider: string) => void;
    setDefaultModel: (model: string) => void;
    setMaxSteps: (maxSteps: number) => void;
    setAdditionalInstruction: (additionalInstruction: string) => void;
    updateProvider: (
      provider: string,
      updates: Partial<AiSettingsSliceConfig['providers'][string]>,
    ) => void;
    setProviderStatus: (
      provider: string,
      status: AiSettingsSliceConfig['providers'][string]['status'],
    ) => void;
    addProvider: (
      provider: string,
      baseUrl: string,
      apiKey: string,
      title?: string,
    ) => void;
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
    loadFromServer: (apiBaseUrl?: string) => Promise<boolean>;
    saveToServer: (apiBaseUrl?: string) => Promise<boolean>;
  };
};

type CreateAiSettingsSliceParams = {
  config?: Partial<AiSettingsSliceConfig>;
};

export function createAiSettingsSlice(
  props?: CreateAiSettingsSliceParams,
): StateCreator<AiSettingsSliceState> {
  const config = createDefaultAiSettingsConfig(props?.config);
  let savedSnapshot = JSON.stringify(config);
  return createSlice<AiSettingsSliceState>((set, get) => ({
    aiSettings: {
      config,
      isSaving: false,
      isLoading: false,
      hasUnsavedChanges: false,
      lastSaveError: null,

      setConfig: (config) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config = config;
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
          }),
        );
      },

      setDefaultProvider: (provider: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.defaultProvider = provider;
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
          }),
        );
      },

      setDefaultModel: (model: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.defaultModel = model;
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
          }),
        );
      },

      setMaxSteps: (maxSteps: number) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.modelParameters.maxSteps = maxSteps;
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
          }),
        );
      },

      setAdditionalInstruction: (additionalInstruction: string) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.modelParameters.additionalInstruction =
              additionalInstruction;
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
          }),
        );
      },

      updateProvider: (
        provider: string,
        updates: Partial<AiSettingsSliceConfig['providers'][string]>,
      ) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.aiSettings.config.providers[provider]) {
              Object.assign(
                draft.aiSettings.config.providers[provider],
                updates,
              );
              draft.aiSettings.hasUnsavedChanges =
                JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
            }
          }),
        );
      },

      setProviderStatus: (provider, status) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.aiSettings.config.providers[provider]) {
              draft.aiSettings.config.providers[provider].status = status;
            }
          }),
        );
      },

      addProvider: (
        provider: string,
        baseUrl: string,
        apiKey: string,
        title,
      ) => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.config.providers[provider] = {
              title: title || provider,
              kind: 'custom',
              baseUrl,
              apiKey,
              models: [],
              defaultAuthMethod: 'manual_api_key',
              experimental: false,
              authMethods: [
                {
                  id: 'manual_api_key',
                  type: 'api_key',
                  label: 'Manually enter API Key',
                  description: '',
                  experimental: false,
                  metadata: {},
                },
              ],
              status: {
                hasCredentials: Boolean(apiKey),
                credentialType: apiKey ? 'api_key' : undefined,
                selectedAuthMethod: 'manual_api_key',
                status: apiKey ? 'connected' : 'disconnected',
              },
            };
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
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
                draft.aiSettings.hasUnsavedChanges =
                  JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
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
              draft.aiSettings.hasUnsavedChanges =
                JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
            }
          }),
        );
      },

      removeProvider: (provider: string) => {
        set((state) =>
          produce(state, (draft) => {
            delete draft.aiSettings.config.providers[provider];
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
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
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
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
                draft.aiSettings.hasUnsavedChanges =
                  JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
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
            draft.aiSettings.hasUnsavedChanges =
              JSON.stringify(draft.aiSettings.config) !== savedSnapshot;
          }),
        );
      },

      loadFromServer: async (apiBaseUrl = '') => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.isLoading = true;
            draft.aiSettings.lastSaveError = null;
          }),
        );
        try {
          const res = await fetch(`${apiBaseUrl}/api/ai/settings`);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg =
              (body as {error?: string}).error ??
              `Server returned ${res.status}`;
            throw new Error(msg);
          }
          const body = (await res.json()) as {config: AiSettingsSliceConfig};
          const nextConfig = AiSettingsSliceConfig.parse(body.config);
          savedSnapshot = JSON.stringify(nextConfig);
          set((state) =>
            produce(state, (draft) => {
              draft.aiSettings.config = nextConfig;
              draft.aiSettings.isLoading = false;
              draft.aiSettings.hasUnsavedChanges = false;
            }),
          );
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          set((state) =>
            produce(state, (draft) => {
              draft.aiSettings.isLoading = false;
              draft.aiSettings.lastSaveError = msg;
            }),
          );
          return false;
        }
      },

      saveToServer: async (apiBaseUrl = '') => {
        set((state) =>
          produce(state, (draft) => {
            draft.aiSettings.isSaving = true;
            draft.aiSettings.lastSaveError = null;
          }),
        );
        try {
          const config = get().aiSettings.config;
          const res = await fetch(`${apiBaseUrl}/api/ai/settings`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({config}),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg =
              (body as {error?: string}).error ??
              `Server returned ${res.status}`;
            throw new Error(msg);
          }
          savedSnapshot = JSON.stringify(config);
          set((state) =>
            produce(state, (draft) => {
              draft.aiSettings.isSaving = false;
              draft.aiSettings.hasUnsavedChanges = false;
            }),
          );
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          set((state) =>
            produce(state, (draft) => {
              draft.aiSettings.isSaving = false;
              draft.aiSettings.lastSaveError = msg;
            }),
          );
          return false;
        }
      },
    },
  }));
}

type AiStateWithSettings = AiSliceState & AiSettingsSliceState;

// Hook to access aiSettings from the room store
export function useStoreWithAiSettings<T>(
  selector: (state: AiStateWithSettings) => T,
): T {
  return useBaseRoomStore<AiStateWithSettings, T>((state) =>
    selector(state as unknown as AiStateWithSettings),
  );
}
