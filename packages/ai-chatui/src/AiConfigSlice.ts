import {StateCreator} from 'zustand';
import {useBaseRoomShellStore} from '@sqlrooms/room-shell';
import {BaseRoomConfig, RoomShellSliceState} from '@sqlrooms/room-shell';
import {produce} from 'immer';

// Local storage keys
const STORAGE_KEYS = {
  AI_CONFIG: 'sqlrooms-ai-config'
};

// Utility functions for localStorage with error handling
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

export interface AiConfigState {
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
}

export interface AiConfigActions {
  setAiConfigType: (type: 'default' | 'custom') => void;
  setDefaultModel: (model: string, provider: string, apiKey?: string) => void;
  setCustomModel: (baseUrl: string, apiKey: string, modelName: string) => void;
  setModelParameters: (parameters: {maxSteps?: number; systemInstruction?: string}) => void;
  setMaxSteps: (maxSteps: number) => void;
  setSystemInstruction: (systemInstruction: string) => void;
}

export type AiConfigSlice = AiConfigState & AiConfigActions;

export function createAiConfigSlice(): StateCreator<AiConfigSlice> {
  return (set, get) => ({
    ...loadFromStorage(STORAGE_KEYS.AI_CONFIG, {
      type: 'default' as 'default' | 'custom',
      defaultModel: {
        model: 'gpt-4.1',
        provider: 'openai',
        apiKey: ''
      },
      customModel: {
        baseUrl: '',
        apiKey: '',
        modelName: ''
      },
      modelParameters: {
        maxSteps: 100,
        systemInstruction: ''
      }
    }),

    setAiConfigType: (type: 'default' | 'custom') => {
      const currentState = get();
      set(state =>
        produce(state, draft => {
          draft.type = type;
        })
      );
      const aiConfigData = {
        type,
        defaultModel: currentState.defaultModel,
        customModel: currentState.customModel,
        modelParameters: currentState.modelParameters
      };
      saveToStorage(STORAGE_KEYS.AI_CONFIG, aiConfigData);
    },

    setDefaultModel: (model: string, provider: string, apiKey?: string) => {
      const currentState = get();
      const newDefaultModel = {model, provider, apiKey};
      set(state =>
        produce(state, draft => {
          draft.defaultModel = newDefaultModel;
        })
      );
      const aiConfigData = {
        type: currentState.type,
        defaultModel: newDefaultModel,
        customModel: currentState.customModel,
        modelParameters: currentState.modelParameters
      };
      saveToStorage(STORAGE_KEYS.AI_CONFIG, aiConfigData);
    },

    setCustomModel: (baseUrl: string, apiKey: string, modelName: string) => {
      const currentState = get();
      const newCustomModel = {baseUrl, apiKey, modelName};
      set(state =>
        produce(state, draft => {
          draft.customModel = newCustomModel;
        })
      );
      const aiConfigData = {
        type: currentState.type,
        defaultModel: currentState.defaultModel,
        customModel: newCustomModel,
        modelParameters: currentState.modelParameters
      };
      saveToStorage(STORAGE_KEYS.AI_CONFIG, aiConfigData);
    },

    setModelParameters: (parameters: {maxSteps?: number; systemInstruction?: string}) => {
      const currentState = get();
      const newModelParameters = {
        ...currentState.modelParameters,
        ...parameters
      };

      set(state =>
        produce(state, draft => {
          draft.modelParameters = newModelParameters;
        })
      );

      const aiConfigData = {
        type: currentState.type,
        defaultModel: currentState.defaultModel,
        customModel: currentState.customModel,
        modelParameters: newModelParameters
      };
      saveToStorage(STORAGE_KEYS.AI_CONFIG, aiConfigData);
    },

    setMaxSteps: (maxSteps: number) => {
      get().setModelParameters({maxSteps});
    },

    setSystemInstruction: (systemInstruction: string) => {
      get().setModelParameters({systemInstruction});
    }
  });
}

// Hook to access aiConfig from the room store
export function useStoreWithAiConfig<T>(selector: (state: AiConfigSlice) => T): T {
  return useBaseRoomShellStore<
    BaseRoomConfig,
    RoomShellSliceState<BaseRoomConfig> & AiConfigSlice,
    T
  >(state => selector(state as unknown as AiConfigSlice));
}
