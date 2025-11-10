import {AiSliceConfig, AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  BaseRoomSliceState,
  createBaseRoomSlice,
  createPersistHelpers,
  createRoomStore,
  StateCreator,
} from '@sqlrooms/room-store';
import {persist} from 'zustand/middleware';
import {AI_SETTINGS} from '../config';
import {getClientTools} from './lib/tools';

type State = BaseRoomSliceState & AiSliceState & AiSettingsSliceState;

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
      // Helper to extract and merge slice configs
      ...createPersistHelpers({
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
      }),
    },
  ) as StateCreator<State>,
);
