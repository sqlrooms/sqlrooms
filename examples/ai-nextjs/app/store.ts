import {AiSliceConfig, AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-store';
import {AI_SETTINGS} from '../config';
import {getClientTools} from './lib/tools';

type State = BaseRoomStoreState & AiSliceState & AiSettingsSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<State>(
  persistSliceConfigs(
    {
      name: 'ai-nextjs-example-app-state-storage',
      sliceConfigSchemas: {
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
      },
    },
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
  ),
);
