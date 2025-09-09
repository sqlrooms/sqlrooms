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
export type AiChatUiSliceConfig = z.infer<typeof AiChatUiSliceConfig>;

export function createDefaultAiChatUiConfig(
  props: Partial<AiChatUiSliceConfig['aiChatUi']>,
): AiChatUiSliceConfig {
  const defaultModelId = 'default-gpt-4o-mini';
  return {
    aiChatUi: {
      type: 'default',
      models: {
        openai: {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          models: [
            {
              id: defaultModelId,
              modelName: 'gpt-4o-mini',
            },
            {
              id: 'default-gpt-4',
              modelName: 'gpt-4',
            },
          ],
        },
        anthropic: {
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: '',
          models: [
            {
              id: 'default-claude-3-sonnet',
              modelName: 'claude-3-5-sonnet',
            },
          ],
        },
      },
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
    models: Record<
      string,
      {
        provider: string;
        baseUrl: string;
        apiKey: string;
        models: Array<{
          id: string;
          modelName: string;
        }>;
      }
    >;
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
    modelName: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
  } | null;
  setAiConfigType: (type: 'default' | 'custom') => void;
  addModel: (modelName: string, provider: string, baseUrl?: string) => string;
  updateModel: (
    id: string,
    updates: {
      modelName?: string;
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
  setModelProviderApiKey: (provider: string, apiKey: string) => void;
  getModelProviderApiKey: (provider: string) => string | undefined;
  addProvider: (provider: string, baseUrl: string, apiKey: string) => void;
  updateProvider: (
    provider: string,
    updates: {
      baseUrl?: string;
      apiKey?: string;
    },
  ) => void;
  removeProvider: (provider: string) => void;
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

        // Find the model across all providers
        for (const providerKey in models) {
          const provider = models[providerKey];
          if (provider) {
            const model = provider.models.find(
              (model) => model.id === selectedModelId,
            );
            if (model) {
              return {
                id: model.id,
                modelName: model.modelName,
                provider: provider.provider,
                baseUrl: provider.baseUrl,
                apiKey: provider.apiKey,
              };
            }
          }
        }
        return null;
      },

      setAiConfigType: (type: 'default' | 'custom') => {
        set((state) =>
          produce(state, (draft) => {
            draft.config.aiChatUi.type = type;
          }),
        );
      },

      addModel: (modelName: string, provider: string, baseUrl?: string) => {
        const id = `${provider}-${modelName}-${Date.now()}`;
        const newModel = {id, modelName};

        set((state) =>
          produce(state, (draft) => {
            // Check if provider already exists
            if (draft.config.aiChatUi.models[provider]) {
              // Add model to existing provider
              draft.config.aiChatUi.models[provider].models.push(newModel);
            } else {
              // Create new provider with the model
              const defaultBaseUrls: Record<string, string> = {
                openai: 'https://api.openai.com/v1',
                anthropic: 'https://api.anthropic.com',
                google: 'https://generativelanguage.googleapis.com/v1',
              };
              draft.config.aiChatUi.models[provider] = {
                provider,
                baseUrl: baseUrl || defaultBaseUrls[provider] || '',
                apiKey: '',
                models: [newModel],
              };
            }

            // If this is the first model across all providers, select it
            const totalModels = Object.values(
              draft.config.aiChatUi.models,
            ).reduce((total, provider) => total + provider.models.length, 0);
            if (totalModels === 1) {
              draft.config.aiChatUi.selectedModelId = id;
            }
          }),
        );
        return id;
      },

      updateModel: (
        id: string,
        updates: {
          modelName?: string;
        },
      ) => {
        set((state) =>
          produce(state, (draft) => {
            // Find the model across all providers
            for (const providerKey in draft.config.aiChatUi.models) {
              const provider = draft.config.aiChatUi.models[providerKey];
              if (provider) {
                const modelIndex = provider.models.findIndex(
                  (model) => model.id === id,
                );
                if (modelIndex !== -1) {
                  const model = provider.models[modelIndex];
                  if (model) {
                    Object.assign(model, updates);
                  }
                  break;
                }
              }
            }
          }),
        );
      },

      removeModel: (id: string) => {
        set((state) =>
          produce(state, (draft) => {
            // Find and remove the model across all providers
            for (const providerKey in draft.config.aiChatUi.models) {
              const provider = draft.config.aiChatUi.models[providerKey];
              if (provider) {
                const modelIndex = provider.models.findIndex(
                  (model) => model.id === id,
                );
                if (modelIndex !== -1) {
                  provider.models.splice(modelIndex, 1);

                  // If provider has no models left, remove the provider
                  if (provider.models.length === 0) {
                    delete draft.config.aiChatUi.models[providerKey];
                  }

                  // If we removed the selected model, select the first available one
                  if (draft.config.aiChatUi.selectedModelId === id) {
                    const allModels = Object.values(
                      draft.config.aiChatUi.models,
                    ).flatMap((provider) => provider?.models || []);
                    draft.config.aiChatUi.selectedModelId =
                      allModels.length > 0 ? allModels[0]?.id : undefined;
                  }
                  break;
                }
              }
            }
          }),
        );
      },

      setSelectedModel: (id: string) => {
        set((state) =>
          produce(state, (draft) => {
            // Check if model exists across all providers
            const modelExists = Object.values(
              draft.config.aiChatUi.models,
            ).some((provider) =>
              provider.models.some((model) => model.id === id),
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

      setModelProviderApiKey: (provider: string, apiKey: string) => {
        set((state) =>
          produce(state, (draft) => {
            if (draft.config.aiChatUi.models[provider]) {
              draft.config.aiChatUi.models[provider].apiKey = apiKey;
            }
          }),
        );
      },

      getModelProviderApiKey: (provider: string) => {
        const state = get();
        return state.config.aiChatUi.models[provider]?.apiKey;
      },

      addProvider: (provider: string, baseUrl: string, apiKey: string) => {
        set((state) =>
          produce(state, (draft) => {
            if (!draft.config.aiChatUi.models[provider]) {
              draft.config.aiChatUi.models[provider] = {
                provider,
                baseUrl,
                apiKey,
                models: [],
              };
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
            if (draft.config.aiChatUi.models[provider]) {
              Object.assign(draft.config.aiChatUi.models[provider], updates);
            }
          }),
        );
      },

      removeProvider: (provider: string) => {
        set((state) =>
          produce(state, (draft) => {
            // If the selected model is from this provider, clear selection
            const selectedModel = Object.values(draft.config.aiChatUi.models)
              .flatMap((p) => p.models)
              .find(
                (model) => model.id === draft.config.aiChatUi.selectedModelId,
              );

            if (
              selectedModel &&
              draft.config.aiChatUi.models[provider]?.models.includes(
                selectedModel,
              )
            ) {
              draft.config.aiChatUi.selectedModelId = undefined;
            }

            delete draft.config.aiChatUi.models[provider];
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
