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
import {
  createWebContainerToolkit,
  WebContainerPersistConfig,
  WebContainerSliceState,
  createWebContainerSlice,
} from '@sqlrooms/webcontainer';
import {scaffolds} from '../../app-scaffolds/scaffolds.generated.json';
import {fileSystemTreeToNodes} from '../components/filetree/fileSystemTreeToNodes';
import {AI_SETTINGS} from '../config';
import {LLM_INSTRUCTIONS} from '../instructions';

type RoomState = BaseRoomStoreState &
  AiSliceState &
  AiSettingsSliceState &
  WebContainerSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'sqlrooms-app-builder',
      sliceConfigSchemas: {
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
        webContainer: WebContainerPersistConfig,
      },
    },
    (set, get, store) => ({
      // Base room slice
      ...createBaseRoomSlice()(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // WebContainer slice
      ...createWebContainerSlice({
        config: {
          filesTree: scaffolds['get-started'],
          activeFilePath: '/src/App.jsx',
        },
      })(set, get, store),

      // Ai slice
      ...(() => {
        const webContainerToolkit = createWebContainerToolkit(store);
        return createAiSlice({
          getInstructions: () => {
            const instructions = `${LLM_INSTRUCTIONS}
            <file_list>
            ${JSON.stringify(fileSystemTreeToNodes(get().webContainer.config.filesTree, '/'), null, 2)}
            </file_list>`;
            return instructions;
          },

          toolRenderers: webContainerToolkit.toolRenderers,

          tools: webContainerToolkit.tools,
        })(set, get, store);
      })(),
    }),
  ),
);
