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
import {scaffolds} from '../../app-scaffolds/scaffolds.generated.json';
import {AI_SETTINGS} from '../config';
import {LLM_INSTRUCTIONS} from '../instructions';
import {createListFilesTool} from '../tools/listFiles/createListFilesTool';
import {createGetFileContentTool} from '../tools/getFileContent/getFileContentTool';
import {
  createWebContainerSlice,
  WebContainerSliceState,
} from './WebContainerSlice';
import {fileSystemTreeToNodes} from '../components/filetree/fileSystemTreeToNodes';

type State = RoomState<BaseRoomConfig> &
  AiSliceState &
  AiSettingsSliceState &
  WebContainerSliceState;
// LayoutSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<BaseRoomConfig, State>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomSlice<BaseRoomConfig>()(set, get, store),

      // ...createLayoutSlice({
      //   config: {
      //     type: LayoutTypes.enum.mosaic,
      //     nodes: {
      //       direction: 'row',
      //       first: 'main',
      //       second: 'sidebar',
      //     },
      //   },
      //   panels: {
      //     main: {
      //       title: 'Main View',
      //       icon: () => null,
      //       component: BrowserView,
      //       placement: 'main',
      //     },
      //   },
      // })(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // WebContainer slice
      ...createWebContainerSlice({
        filesTree: scaffolds['get-started'],
      })(set, get, store),

      // Ai slice
      ...createAiSlice({
        getInstructions: () => `${LLM_INSTRUCTIONS} 
        <file_list>
          ${JSON.stringify(fileSystemTreeToNodes(get().wc.filesTree, '/', null, 2))}
        </file_list>`,

        // Add custom tools
        tools: {
          // Example of adding a simple echo tool
          listFiles: createListFilesTool(store),
          getFileContent: createGetFileContentTool(store),
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
