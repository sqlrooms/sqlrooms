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
import EchoToolResult from '../tools/EchoToolResult';
import {AI_SETTINGS} from '../config';
import {
  createWebContainerSlice,
  WebContainerSliceState,
} from './WebContainerSlice';
import {INITIAL_FILES_TREE} from './initialFilesTree';
import {SCAFFOLDS} from './generatedScaffolds';

type State = RoomState<BaseRoomConfig> &
  AiSliceState &
  AiSettingsSliceState &
  WebContainerSliceState;

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

      // WebContainer slice
      ...createWebContainerSlice({
        filesTree: SCAFFOLDS['get-started'],
      })(set, get, store),

      // Ai slice
      ...createAiSlice({
        getInstructions: () => {
          return `You are an AI assistant that can answer questions and help with tasks.`;
        },

        // Add custom tools
        tools: {
          // Example of adding a simple echo tool
          echo: {
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

    // Persist settings
    {
      // Local storage key
      name: 'sqlrooms-app-builder',
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
