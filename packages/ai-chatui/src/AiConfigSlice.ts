import {StateCreator} from 'zustand';
import {useBaseRoomShellStore, createSlice} from '@sqlrooms/room-shell';
import {BaseRoomConfig, RoomShellSliceState} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {z} from 'zod';

export const AiChatUiSliceConfig = z.object({
  aiChatUi: z.object({
    type: z.enum(['default', 'custom']),
    defaultModel: z.object({
      model: z.string(),
      provider: z.string(),
      apiKey: z.string().optional(),
    }),
    customModel: z.object({
      baseUrl: z.string(),
      apiKey: z.string(),
      modelName: z.string(),
    }),
    modelParameters: z.object({
      maxSteps: z.number(),
      systemInstruction: z.string(),
    }),
  }),
});
export type AiChatUiSliceConfig = z.infer<typeof AiChatUiSliceConfig>;

export function createDefaultAiChatUiConfig(
  props: Partial<AiChatUiSliceConfig['aiChatUi']>,
): AiChatUiSliceConfig {
  return {
    aiChatUi: {
      type: 'default',
      defaultModel: {
        model: 'gpt-4.1',
        provider: 'openai',
        apiKey: '',
      },
      customModel: {
        baseUrl: '',
        apiKey: '',
        modelName: '',
      },
      modelParameters: {
        maxSteps: 10,
        systemInstruction: '',
      },
      ...props,
    },
  };
}
export type AiChatUiSliceState = {
  aiChatUi: {
    type: 'default' | 'custom';
    defaultModel: {
      model: string;
      provider: string;
      apiKey?: string;
    };
    customModel: {
      baseUrl: string;
      apiKey: string;
      modelName: string;
    };
    modelParameters: {
      maxSteps: number;
      systemInstruction: string;
    };
    getAiConfig: () => {
      type: 'default' | 'custom';
      defaultModel: {
        model: string;
        provider: string;
        apiKey?: string;
      };
      customModel: {
        baseUrl: string;
        apiKey: string;
        modelName: string;
      };
      modelParameters: {
        maxSteps: number;
        systemInstruction: string;
      };
    };
    setAiConfigType: (type: 'default' | 'custom') => void;
    setDefaultModel: (model: string, provider: string, apiKey?: string) => void;
    setCustomModel: (
      baseUrl: string,
      apiKey: string,
      modelName: string,
    ) => void;
    setModelParameters: (parameters: {
      maxSteps?: number;
      systemInstruction?: string;
    }) => void;
    setMaxSteps: (maxSteps: number) => void;
    setSystemInstruction: (systemInstruction: string) => void;
  };
};

type CreateAiChatUiSliceParams = {
  initialType?: 'default' | 'custom';
  initialDefaultModel?: string;
  initialDefaultModelProvider?: string;
  initialDefaultModelApiKey?: string;
  initialDefaultCustomModelBaseUrl?: string;
  initialDefaultCustomModelApiKey?: string;
  initialDefaultCustomModelModelName?: string;
  initialMaxSteps?: number;
  initialSystemInstruction?: string;
};

export function createAiChatUiSlice<
  PC extends BaseRoomConfig & AiChatUiSliceConfig,
>(params: CreateAiChatUiSliceParams = {}): StateCreator<AiChatUiSliceState> {
  const {
    initialType = 'default',
    initialDefaultModel = 'gpt-4.1',
    initialDefaultModelProvider = 'openai',
    initialDefaultModelApiKey = '',
    initialDefaultCustomModelBaseUrl = '',
    initialDefaultCustomModelApiKey = '',
    initialDefaultCustomModelModelName = '',
    initialMaxSteps = 10,
    initialSystemInstruction = '',
  } = params;

  return createSlice<PC, AiChatUiSliceState>((set, get) => {
    return {
      aiChatUi: {
        type: initialType,
        defaultModel: {
          model: initialDefaultModel,
          provider: initialDefaultModelProvider,
          apiKey: initialDefaultModelApiKey,
        },
        customModel: {
          baseUrl: initialDefaultCustomModelBaseUrl,
          apiKey: initialDefaultCustomModelApiKey,
          modelName: initialDefaultCustomModelModelName,
        },
        modelParameters: {
          maxSteps: initialMaxSteps,
          systemInstruction: initialSystemInstruction,
        },

        getAiConfig: () => {
          const state = get();
          return state.aiChatUi;
        },

        setAiConfigType: (type: 'default' | 'custom') => {
          set((state) =>
            produce(state, (draft) => {
              draft.aiChatUi.type = type;
            }),
          );
        },

        setDefaultModel: (model: string, provider: string, apiKey?: string) => {
          const newDefaultModel = {model, provider, apiKey};
          set((state) =>
            produce(state, (draft) => {
              draft.aiChatUi.defaultModel = newDefaultModel;
            }),
          );
        },

        setCustomModel: (
          baseUrl: string,
          apiKey: string,
          modelName: string,
        ) => {
          const newCustomModel = {baseUrl, apiKey, modelName};
          set((state) =>
            produce(state, (draft) => {
              draft.aiChatUi.customModel = newCustomModel;
            }),
          );
        },

        setModelParameters: (parameters: {
          maxSteps?: number;
          systemInstruction?: string;
        }) => {
          set((state) =>
            produce(state, (draft) => {
              const newParameters = {
                ...draft.aiChatUi.modelParameters,
                ...parameters,
              };
              draft.aiChatUi.modelParameters = newParameters;
            }),
          );
        },

        setMaxSteps: (maxSteps: number) => {
          set((state) =>
            produce(state, (draft) => {
              draft.aiChatUi.modelParameters.maxSteps = maxSteps;
            }),
          );
        },

        setSystemInstruction: (systemInstruction: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.aiChatUi.modelParameters.systemInstruction =
                systemInstruction;
            }),
          );
        },
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
