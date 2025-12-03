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
import {z} from 'zod';
import EchoToolResult from './components/EchoToolResult';
import {AI_SETTINGS} from './config';

type State = BaseRoomStoreState & AiSliceState & AiSettingsSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<State>(
  persistSliceConfigs(
    {
      name: 'ai-core-example-app-state-storage',
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
          return `You are an AI assistant that can answer questions and help with tasks.`;
        },

        // Add custom tools
        tools: {
          // Example of adding a simple echo tool
          echo: {
            name: 'echo',
            description: 'A simple echo tool that returns the input text',
            parameters: z.object({
              text: z.string().describe('The text to echo back'),
            }),
            execute: async ({text}: {text: string}) => {
              return {
                llmResult: {
                  success: true,
                  details: `Echo: ${text}`,
                },
              };
            },
            component: EchoToolResult,
          },
        },
      })(set, get, store),
    }),
  ),
);
