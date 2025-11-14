import {AiSliceConfig, AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  createBaseRoomSlice,
  createPersistHelpers,
  createRoomStore,
  BaseRoomStoreState,
  StateCreator,
} from '@sqlrooms/room-store';
import {persist} from 'zustand/middleware';
import {AI_SETTINGS} from './config';
import {weatherAgentTool} from './agents/WeatherAgent';

type State = BaseRoomStoreState & AiSliceState & AiSettingsSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<State>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createBaseRoomSlice()(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // Ai slice
      ...createAiSlice({
        getInstructions: () => {
          return `You are an AI assistant that can answer questions and help with tasks.`;
        },

        // Add custom tools
        tools: {
          // Example of using an agent as a tool
          'agent-weather': weatherAgentTool(store),
        },
      })(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'ai-agent-example-app-state-storage',
      // Helper to extract and merge slice configs
      ...createPersistHelpers({
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
      }),
    },
  ) as StateCreator<State>,
);
