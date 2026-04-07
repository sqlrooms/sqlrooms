import {AiSliceConfig, AiSliceState, createAiSlice} from '@sqlrooms/ai-core';
import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  createAiSettingsSlice,
} from '@sqlrooms/ai-settings';
import {
  createBaseRoomSlice,
  createRoomStore,
  BaseRoomStoreState,
  persistSliceConfigs,
} from '@sqlrooms/room-store';
import {AI_SETTINGS} from './config';
import {travelPlannerAgentTool} from './agents/TravelPlannerAgent';
import {BookHotelApprovalRenderer} from './components/BookHotelApprovalRenderer';

type State = BaseRoomStoreState & AiSliceState & AiSettingsSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<State>(
  persistSliceConfigs(
    {
      name: 'ai-subagents-example-app-state-storage',
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

      // Ai slice
      ...createAiSlice({
        getInstructions: () => {
          return `You are an AI travel planning assistant. You can help users plan trips by checking weather, finding activities, and booking hotels.`;
        },

        tools: {
          'agent-travel-planner': travelPlannerAgentTool(store),
        },

        toolRenderers: {
          bookHotel: BookHotelApprovalRenderer,
        } as Record<string, typeof BookHotelApprovalRenderer>,
      })(set, get, store),
    }),
  ),
);
