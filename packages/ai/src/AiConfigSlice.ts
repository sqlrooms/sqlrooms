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
    models: z.record(
      z.string(),
      z.object({
        provider: z.string(),
        baseUrl: z.string(),
        apiKey: z.string(),
        models: z.array(
          z.object({
            id: z.string(), // gpt-5 same as modelName
            modelName: z.string(),
          }),
        ),
      }),
    ),
    customModels: z.array(
      z.object({
        id: z.string(), // mycoolmodel, collision detection: gpt-5
        baseUrl: z.string(),
        apiKey: z.string(),
        modelName: z.string(), // qwen
      }),
    ),
    modelParameters: z.object({
      maxSteps: z.number(),
      additionalInstruction: z.string(),
    }),
    // each session will have its own model
    sessions: z.array(
      z.object({
        id: z.string(),
        // custom model cuid or provider's model cuid
        selectedModelId: z.string(),
      }),
    ),
  }),
});
export type AiModelSliceConfig = z.infer<typeof AiModelSliceConfig>;

export function createDefaultAiModelConfig(
  props: Partial<AiModelSliceConfig['aiModelConfig']>,
  aiSessions?: Array<{id: string; modelProvider?: string; model?: string}>,
): AiModelSliceConfig {
  // Create model config sessions that align with AI sessions
  const sessions =
    aiSessions?.map((session) => ({
      id: session.id,
      selectedModelId: session.model || 'gpt-4.1',
    })) || [];

  return {
    aiModelConfig: {
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
      customModels: [
        {
          id: 'mycoolmodel',
          baseUrl: 'http://localhost:8000',
          apiKey: '',
          modelName: 'qwen',
        },
      ],
      modelParameters: {
        maxSteps: 5,
        additionalInstruction: '',
      },
      sessions,
      ...props,
    },
  };
}

export type AiModelConfigSliceState = {
  getAiModelConfig: () => AiModelSliceConfig['aiModelConfig'];
  getModelTypeBySessionId: (sessionId: string) => 'default' | 'custom';
  getCustomModelBySessionId: (sessionId: string) => {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  } | null;
  setSessionModelType: (sessionId: string, type: 'default' | 'custom') => void;
  setSessionSelectedModel: (sessionId: string, id: string) => void;
  setSessionCustomModel: (
    sessionId: string,
    baseUrl: string,
    apiKey: string,
    modelName: string,
  ) => void;
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
  addSession: (
    sessionId: string,
    modelType?: 'default' | 'custom',
    selectedModelId?: string,
  ) => void;
  removeSession: (sessionId: string) => void;
  switchToSession: (sessionId: string) => void;
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

      getModelTypeBySessionId: (sessionId: string) => {
        return 'default';
      },

      getCustomModelBySessionId: (sessionId: string) => {
        return {
          baseUrl: '',
          apiKey: '',
          modelName: '',
        };
      },

      setSessionModelType: (sessionId: string, type: 'default' | 'custom') => {
        set((state) =>
          produce(state, (draft) => {
            const session = draft.config.aiModelConfig.sessions.find(
              (s) => s.id === sessionId,
            );
          }),
        );
      },

      setSessionSelectedModel: (sessionId: string, id: string) => {
        set((state) =>
          produce(state, (draft) => {
            // Check if model exists across all providers
            const modelExists = Object.values(
              draft.config.aiModelConfig.models,
            ).some((provider) =>
              provider.models.some((model) => model.id === id),
            );

            if (modelExists) {
              const session = draft.config.aiModelConfig.sessions.find(
                (s) => s.id === sessionId,
              );
              if (session) {
                session.selectedModelId = id;
              }
            }
          }),
        );
      },

      setSessionCustomModel: (
        sessionId: string,
        baseUrl: string,
        apiKey: string,
        modelName: string,
      ) => {
        set((state) =>
          produce(state, (draft) => {
            const session = draft.config.aiModelConfig.sessions.find(
              (s) => s.id === sessionId,
            );
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

      addSession: (
        sessionId: string,
        modelType = 'default',
        selectedModelId = 'gpt-4.1',
      ) => {
        set((state) =>
          produce(state, (draft) => {
            const newSession = {
              id: sessionId,
              selectedModelId,
            };
            draft.config.aiModelConfig.sessions.push(newSession);
          }),
        );
      },

      removeSession: (sessionId: string) => {
        set((state) =>
          produce(state, (draft) => {
            const sessionIndex = draft.config.aiModelConfig.sessions.findIndex(
              (s) => s.id === sessionId,
            );
            if (sessionIndex !== -1) {
              draft.config.aiModelConfig.sessions.splice(sessionIndex, 1);
            }
          }),
        );
      },

      switchToSession: () => {
        // This method doesn't need to do anything as session switching is handled by AiSlice
        // The UI will automatically update based on the current session ID
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
