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
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {AI_SETTINGS} from '../config';
import WebSearchToolResult from '@/components/WebSearchToolResult';

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
          return `You are a helpful assistant that can answer questions and help with tasks.
You can use the following datasets:
- datasetName: natregimes
- variables: [HR60, PO60, latitude, longitude]
- datasetName: world_countries
- variables: [id, latitude, longitude]`;
        },

        // Add custom tools
        tools: {
          // Example of adding a web search tool
          webSearch: {
            name: 'webSearch',
            description: 'Search the web for information',
            parameters: z.object({
              query: z.string().describe('The search query'),
            }),
            execute: async ({query}: {query: string}) => {
              // This is just a toy implementation
              // In a real app, you would make an actual web search
              return {
                llmResult: {
                  success: true,
                  details: `Web search results for: ${query}`,
                  results: [
                    {
                      title: 'Example Result',
                      snippet: 'This is a toy web search result',
                      url: 'https://example.com',
                    },
                  ],
                },
              };
            },
            component: WebSearchToolResult,
          },
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
