import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import type {BlockSettingsComponent, SelectedBlock} from './types';

/**
 * Block Settings Slice
 *
 * TWO-TIER SELECTION SYSTEM:
 *
 * This slice manages panel-level selection (dashboard panels, standalone blocks
 * that need custom selection). As of the TipTap selection migration:
 *
 * - BLOCK-LEVEL selection: Handled by TipTap's native node selection
 *   (dashboard blocks, chart blocks, data table blocks in documents)
 *
 * - PANEL-LEVEL selection: Handled by this slice (custom selection)
 *   (individual panels inside dashboards, standalone selectable components)
 *
 * The BlockSettingsPanel reads from both sources with panel selection taking
 * priority (more specific than block selection).
 *
 * DO NOT use this slice for selecting blocks in TipTap documents - use
 * TipTap's editor.commands.setNodeSelection() instead.
 */

/**
 * Configuration for the block settings slice
 */
export type BlockSettingsSliceConfig = {
  /** Currently selected block, if any */
  selectedBlock?: SelectedBlock;
};

/**
 * State shape for the block settings slice
 */
export type BlockSettingsSliceState = {
  blockSettings: {
    config: BlockSettingsSliceConfig;
    runtime: {
      /** Registry of settings components by block type */
      settingsRegistry: Record<string, BlockSettingsComponent>;
    };
    /** Select a block */
    selectBlock: (block: SelectedBlock) => void;
    /** Clear the current selection */
    clearSelection: () => void;
    /** Check if a specific block is selected */
    isBlockSelected: (
      type: string,
      id: string,
      dashboardId?: string,
    ) => boolean;
    /** Get the settings component for a block type */
    getSettings: (blockType: string) => BlockSettingsComponent | undefined;
    /** Clear selection if a block is deleted */
    clearSelectionIfBlockDeleted: (blockId: string) => void;
  };
};

/**
 * Options for creating the block settings slice
 */
export type CreateBlockSettingsSliceOptions = {
  /**
   * Initial settings components registry.
   * Key format: 'dashboard-panel:{panelType}' or 'standalone-block:{blockType}'
   */
  settingsRegistry?: Record<string, BlockSettingsComponent>;
};

/**
 * Checks if the selected block matches the given criteria.
 */
function isBlockMatch(
  selected: SelectedBlock,
  type: string,
  id: string,
  dashboardId?: string,
): boolean {
  return (
    selected.type === type &&
    selected.id === id &&
    selected.dashboardId === dashboardId
  );
}

/**
 * Checks if a block should clear the current selection when deleted.
 */
function shouldClearOnDelete(
  selected: SelectedBlock,
  deletedBlockId: string,
): boolean {
  return (
    selected.id === deletedBlockId || selected.dashboardId === deletedBlockId
  );
}

/**
 * Creates a Zustand slice for managing block selection state.
 *
 * This slice handles:
 * - Selecting/deselecting blocks
 * - Storing settings component registry
 * - Querying selection state
 *
 * @param options - Configuration options including initial settings registry
 * @returns Zustand slice creator function
 *
 * @example
 * ```typescript
 * const store = createRoomStore({
 *   ...createBlockSelectionSlice({
 *     settingsRegistry: {
 *       'dashboard-panel:vgplot': ChartSettings,
 *       'standalone-block:chart-block': ChartSettings,
 *     }
 *   })(set, get, store)
 * });
 * ```
 */
export function createBlockSettingsSlice<
  TRoomState extends BaseRoomStoreState & BlockSettingsSliceState,
>(options?: CreateBlockSettingsSliceOptions) {
  return createSlice<BlockSettingsSliceState, TRoomState>((set, get) => ({
    blockSettings: {
      config: {
        selectedBlock: undefined,
      },
      runtime: {
        settingsRegistry: options?.settingsRegistry ?? {},
      },

      selectBlock: (block: SelectedBlock) => {
        set((state) =>
          produce(state, (draft) => {
            draft.blockSettings.config.selectedBlock = block;
          }),
        );
      },

      clearSelection: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.blockSettings.config.selectedBlock = undefined;
          }),
        );
      },

      isBlockSelected: (
        type: string,
        id: string,
        dashboardId?: string,
      ): boolean => {
        const selected = get().blockSettings.config.selectedBlock;
        return selected ? isBlockMatch(selected, type, id, dashboardId) : false;
      },

      getSettings: (blockType: string): BlockSettingsComponent | undefined => {
        return get().blockSettings.runtime.settingsRegistry[blockType];
      },

      clearSelectionIfBlockDeleted: (blockId: string) => {
        const {selectedBlock} = get().blockSettings.config;
        if (selectedBlock && shouldClearOnDelete(selectedBlock, blockId)) {
          get().blockSettings.clearSelection();
        }
      },
    },
  }));
}
