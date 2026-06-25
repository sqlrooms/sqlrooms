import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import type {BlockSettingsComponent, SelectedBlock} from './types';

/**
 * Block Selection Slice
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
 * Configuration for the block selection slice
 */
export type BlockSelectionSliceConfig = {
  /** Currently selected block, if any */
  selectedBlock?: SelectedBlock;
};

/**
 * State shape for the block selection slice
 */
export type BlockSelectionSliceState = {
  blockSelection: {
    config: BlockSelectionSliceConfig;
    runtime: {
      /** Registry of settings components by block type */
      settingsRegistry: Record<string, BlockSettingsComponent>;
    };
    /** Select a block */
    selectBlock: (block: SelectedBlock) => void;
    /** Clear the current selection */
    clearSelection: () => void;
    /** Get the currently selected block */
    getSelectedBlock: () => SelectedBlock | undefined;
    /** Check if a specific block is selected */
    isBlockSelected: (
      type: string,
      id: string,
      dashboardId?: string,
    ) => boolean;
    /** Get the settings component for a block type */
    getSettings: (blockType: string) => BlockSettingsComponent | undefined;
  };
};

/**
 * Options for creating the block selection slice
 */
export type CreateBlockSelectionSliceOptions = {
  /**
   * Initial settings components registry.
   * Key format: 'dashboard-panel:{panelType}' or 'standalone-block:{blockType}'
   */
  settingsRegistry?: Record<string, BlockSettingsComponent>;
};

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
export function createBlockSelectionSlice<
  TRoomState extends BaseRoomStoreState & BlockSelectionSliceState,
>(options?: CreateBlockSelectionSliceOptions) {
  return createSlice<BlockSelectionSliceState, TRoomState>((set, get) => ({
    blockSelection: {
      config: {
        selectedBlock: undefined,
      },
      runtime: {
        settingsRegistry: options?.settingsRegistry ?? {},
      },
      selectBlock: (block: SelectedBlock) => {
        set((state) =>
          produce(state, (draft) => {
            draft.blockSelection.config.selectedBlock = block;
          }),
        );
      },

      clearSelection: () => {
        set((state) =>
          produce(state, (draft) => {
            draft.blockSelection.config.selectedBlock = undefined;
          }),
        );
      },

      getSelectedBlock: () => {
        return get().blockSelection.config.selectedBlock;
      },

      isBlockSelected: (
        type: string,
        id: string,
        dashboardId?: string,
      ): boolean => {
        const selected = get().blockSelection.config.selectedBlock;
        if (!selected) return false;

        return (
          selected.type === type &&
          selected.id === id &&
          selected.dashboardId === dashboardId
        );
      },

      getSettings: (blockType: string): BlockSettingsComponent | undefined => {
        return get().blockSelection.runtime.settingsRegistry[blockType];
      },
    },
  }));
}
