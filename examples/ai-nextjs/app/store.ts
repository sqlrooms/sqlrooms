import {AiSliceConfig, AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  BaseRoomConfig,
  createRoomSlice,
  createRoomStore,
  RoomState,
  StateCreator,
} from '@sqlrooms/room-store';
import {persist} from 'zustand/middleware';
import {AI_SETTINGS} from '../config';
import {getClientTools} from './lib/tools';

type State = RoomState<BaseRoomConfig> & AiSliceState & AiSettingsSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<BaseRoomConfig, State>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomSlice<BaseRoomConfig>()(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // Ai slice with server-side endpoint
      ...createAiSlice({
        // Point to the Next.js API route
        chatEndPoint: '/api/chat',

        getInstructions: () => {
          return 'You are a helpful assistant that can answer questions and help with tasks';
        },

        // Add custom tools
        tools: {
          ...getClientTools(),
        },
      })(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'ai-nextjs-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        ai: AiSliceConfig.parse(state.ai.config),
        aiSettings: AiSettingsSliceConfig.parse(state.aiSettings.config),
      }),
      // Combining the persisted state with the current one when loading from local storage
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ai: {
          ...currentState.ai,
          config: AiSliceConfig.parse(persistedState.ai),
        },
        aiSettings: {
          ...currentState.aiSettings,
          config: AiSettingsSliceConfig.parse(persistedState.aiSettings),
        },
      }),
    },
  ) as StateCreator<State>,
);
