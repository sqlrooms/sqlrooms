import {
  RoomState,
  createBaseSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {produce} from 'immer';
import {z} from 'zod';
import {removeMosaicNodeByKey} from './mosaic';
import React from 'react';
import {StateCreator} from 'zustand';
import {
  LayoutConfig,
  DEFAULT_MOSAIC_LAYOUT,
  MAIN_VIEW,
  isMosaicLayoutParent,
  MosaicLayoutNode,
  MosaicLayoutParent,
} from '@sqlrooms/layout-config';

/**
 * Layout constants defining split percentages for different panel arrangements.
 * These values maintain consistent proportions across different layout configurations.
 */
const LAYOUT_PERCENTAGES = {
  /** Percentage allocated to left sidebar in a three-column layout */
  LEFT_SIDEBAR: 25,
  /** Default percentage for main content areas */
  MAIN_CONTENT: 75,
  /** Split ratio when adding right sidebar to existing middle section (50/(50+25)) */
  RIGHT_SIDEBAR_IN_MIDDLE: 66.67,
} as const;

/**
 * Types for the optimized layout operation system.
 * This system replaces the previous deeply nested conditional logic with a strategy pattern.
 */

/** Represents the type of operation being performed on the layout */
type LayoutOperation = 'add' | 'remove';

/**
 * Strategy interface for handling different panel placement types.
 * Each strategy encapsulates the logic for a specific placement behavior.
 */
type PlacementStrategy = {
  /** Determines if this strategy can handle the given placement type */
  canHandle: (placement: string) => boolean;
  /**
   * Executes the layout operation using this strategy
   * @param layout - The current layout configuration to modify
   * @param panel - The panel identifier being added/removed
   * @param operation - Whether this is an 'add' or 'remove' operation
   * @param placement - The placement type (sidebar-right, sidebar-bottom, etc.)
   */
  execute: (
    layout: LayoutConfig,
    panel: string,
    operation: LayoutOperation,
    placement?: string
  ) => void;
};

/**
 * Helper functions for layout manipulation.
 * These utilities abstract common layout operations and improve code reusability.
 */

/**
 * Creates a new split node in the mosaic layout tree.
 * @param direction - The split direction ('row' for horizontal, 'column' for vertical)
 * @param first - The first child node
 * @param second - The second child node
 * @param splitPercentage - Percentage of space allocated to the first child (0-100)
 * @returns A new parent node containing the split configuration
 */
function createSplitNode(
  direction: 'row' | 'column',
  first: MosaicLayoutNode,
  second: MosaicLayoutNode,
  splitPercentage: number
): MosaicLayoutParent {
  return {
    direction,
    first,
    second,
    splitPercentage,
  };
}

/**
 * Determines if a node can be safely replaced during panel operations.
 * A node is replaceable if it's a leaf node (string), not the main view,
 * and not marked as fixed or pinned.
 */
function isValidReplaceableNode(
  node: MosaicLayoutNode,
  layout: LayoutConfig
): boolean {
  return (
    typeof node === 'string' &&
    node !== MAIN_VIEW &&
    !layout.fixed?.includes(node) &&
    !layout.pinned?.includes(node)
  );
}

/**
 * Finds the middle section in a layout structure.
 * In a three-column layout [left] [middle] [right], returns the middle section.
 * In a two-column layout [left] [right], returns the right section.
 */
function findMiddleSection(root: MosaicLayoutParent): MosaicLayoutNode | null {
  if (root.direction === 'row') {
    const secondNode = root.second;
    if (isMosaicLayoutParent(secondNode) && secondNode.direction === 'row') {
      return secondNode.first; // [left] [middle] [right] structure
    }
    return secondNode; // [left] [right] structure
  }
  return null;
}

/**
 * Checks if the layout has a three-column structure: [left] [middle] [right].
 * This is identified by a root row split where the second child is also a row split.
 */
function hasThreeColumnLayout(root: MosaicLayoutNode): boolean {
  return (
    isMosaicLayoutParent(root) &&
    root.direction === 'row' &&
    isMosaicLayoutParent(root.second) &&
    root.second.direction === 'row'
  );
}

/**
 * Strategy for handling sidebar-right panel placement.
 * Manages panels that should appear on the rightmost edge of the layout.
 *
 * Layout transformations:
 * - Add: [left] [right] → [left] [middle] [right] or replace existing right panel
 * - Remove: [left] [middle] [right] → [left] [right] or [left] [right] → [left]
 */
const sidebarRightStrategy: PlacementStrategy = {
  canHandle: (placement) => placement === 'sidebar-right',

  execute: (layout, panel, operation) => {
    const root = layout.nodes;
    if (!isMosaicLayoutParent(root) || root.direction !== 'row') {
      return;
    }

    if (operation === 'add') {
      const secondNode = root.second;
      if (hasThreeColumnLayout(root)) {
        // [left] [middle] [right] - replace right panel
        (root.second as MosaicLayoutParent).second = panel;
      } else {
        // [left] [right] - split right side to add new right panel
        root.second = createSplitNode(
          'row',
          secondNode,
          panel,
          LAYOUT_PERCENTAGES.RIGHT_SIDEBAR_IN_MIDDLE
        );
        root.splitPercentage = LAYOUT_PERCENTAGES.LEFT_SIDEBAR;
      }
    } else {
      // Remove operation
      const secondNode = root.second;
      if (hasThreeColumnLayout(root)) {
        // [left] [middle] [right] - remove right, keep middle
        root.second = (secondNode as MosaicLayoutParent).first;
        root.splitPercentage = LAYOUT_PERCENTAGES.LEFT_SIDEBAR;
      } else {
        // [left] [right] - remove right, expand left to full width
        layout.nodes = root.first;
      }
    }
  },
};

/**
 * Strategy for handling sidebar-bottom panel placement.
 * Manages panels that should appear at the bottom of the main content area.
 *
 * Layout transformations:
 * - Add: Finds the main content area and splits it vertically to add bottom panel
 * - Remove: Collapses vertical splits to remove bottom panels
 *
 * Works with both two-column [left] [right] and three-column [left] [middle] [right] layouts.
 */
const sidebarBottomStrategy: PlacementStrategy = {
  canHandle: (placement) => placement === 'sidebar-bottom',

  execute: (layout, panel, operation) => {
    const root = layout.nodes;
    if (!isMosaicLayoutParent(root)) {
      return;
    }

    if (operation === 'add') {
      const middleSection = findMiddleSection(root);
      if (!middleSection) {
        // Fallback: create simple vertical split
        layout.nodes = createSplitNode('column', root, panel, LAYOUT_PERCENTAGES.MAIN_CONTENT);
        return;
      }

      const targetNode = hasThreeColumnLayout(root)
        ? (root.second as MosaicLayoutParent)
        : root;
      const targetSection = hasThreeColumnLayout(root) ? 'first' : 'second';

      if (isMosaicLayoutParent(middleSection) && middleSection.direction === 'column') {
        // Middle already has column structure
        const bottomNode = middleSection.second;
        if (isValidReplaceableNode(bottomNode, layout)) {
          middleSection.second = panel;
        } else {
          // Create new split in the middle section
          targetNode[targetSection] = createSplitNode(
            'column',
            middleSection,
            panel,
            LAYOUT_PERCENTAGES.MAIN_CONTENT
          );
        }
      } else {
        // Split the target section vertically
        targetNode[targetSection] = createSplitNode(
          'column',
          middleSection,
          panel,
          LAYOUT_PERCENTAGES.MAIN_CONTENT
        );
      }
    } else {
      // Remove operation
      const middleSection = findMiddleSection(root);
      if (isMosaicLayoutParent(middleSection) && middleSection.direction === 'column') {
        const targetNode = hasThreeColumnLayout(root)
          ? (root.second as MosaicLayoutParent)
          : root;
        const targetSection = hasThreeColumnLayout(root) ? 'first' : 'second';

        // Collapse column structure to just the first (top) part
        targetNode[targetSection] = middleSection.first;
      }
    }
  },
};

/**
 * Default fallback strategy for handling standard panel placements.
 * Handles 'sidebar', 'main', and other placement types using the original logic.
 * Always returns true for canHandle() to serve as the final fallback strategy.
 */
const defaultStrategy: PlacementStrategy = {
  canHandle: () => true, // Always can handle as fallback

  execute: (layout, panel, operation, placement = '') => {
    if (operation === 'remove') {
      return;
    }

    // Add operation - original logic for sidebar and other placements
    const root = layout.nodes;
    const side = placement === 'sidebar' ? 'first' : 'second';

    const toReplace = isMosaicLayoutParent(root) ? root[side] : undefined;

    if (
      toReplace &&
      isMosaicLayoutParent(root) &&
      !isMosaicLayoutParent(toReplace) &&
      isValidReplaceableNode(toReplace, layout)
    ) {
      // Replace first un-pinned leaf
      root[side] = panel;
    }
  },
};

/**
 * Array of placement strategies ordered by specificity.
 * Strategies are checked in order, with more specific ones first and the default fallback last.
 */
const placementStrategies: PlacementStrategy[] = [
  sidebarRightStrategy,
  sidebarBottomStrategy,
  defaultStrategy, // Must be last as it always returns true for canHandle()
];

/**
 * Main function for executing layout operations using the strategy pattern.
 * This replaces the previous complex conditional logic with a clean, extensible system.
 *
 * @param layout - The layout configuration to modify
 * @param panel - The panel identifier being added or removed
 * @param operation - The type of operation ('add' or 'remove')
 * @param placement - The panel placement type (sidebar-right, sidebar-bottom, etc.)
 */
function executeLayoutOperation(
  layout: LayoutConfig,
  panel: string,
  operation: LayoutOperation,
  placement: string,
): void {
  const strategy = placementStrategies.find(s => s.canHandle(placement));
  if (strategy) {
    strategy.execute(layout, panel, operation, placement);
  }
}

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'sidebar-right' | 'main' | 'top-bar';
};

export const LayoutSliceConfig = z.object({
  layout: z
    .any()
    .describe('Mosaic layout configuration.')
    .default(DEFAULT_MOSAIC_LAYOUT),
});

export type LayoutSliceConfig = z.infer<typeof LayoutSliceConfig>;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return {
    layout: DEFAULT_MOSAIC_LAYOUT,
  };
}

export type LayoutSliceState = {
  layout: {
    panels: Record<string, RoomPanelInfo>;
    setLayout(layout: LayoutConfig): void;
    togglePanel: (panel: string, show?: boolean) => void;
    togglePanelPin: (panel: string) => void;
  };
};

export function createLayoutSlice<
  PC extends BaseRoomConfig & LayoutSliceConfig,
>({
  panels = {},
}: {
  panels?: Record<string, RoomPanelInfo>;
} = {}): StateCreator<LayoutSliceState> {
  return createBaseSlice<PC, LayoutSliceState>((set, get) => ({
    layout: {
      panels,
      setLayout: (layout) =>
        set((state) =>
          produce(state, (draft) => {
            draft.config.layout = layout;
          }),
        ),
      togglePanel: (panel, show) => {
        const {config} = get();
        if (config.layout?.nodes === panel) {
          // don't hide the view if it's the only one
          return;
        }
        const result = removeMosaicNodeByKey(config.layout?.nodes, panel);
        const isShown = result.success;
        if (isShown) {
          if (show || panel === MAIN_VIEW /*&& areViewsReadyToRender()*/) {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              const layout = draft.config.layout;
              const placement = get().layout.panels[panel]?.placement || '';

              // remove the panel
              executeLayoutOperation(
                layout,
                panel,
                'remove',
                placement,
              );

              // Clean up pinned panels
              if (layout.pinned?.includes(panel)) {
                layout.pinned = layout.pinned.filter(
                  (p: string) => p !== panel,
                );
              }
            }),
          );
        } else {
          if (show === false) {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              const layout = draft.config.layout;
              const placement = get().layout.panels[panel]?.placement || '';

              // add the panel
              executeLayoutOperation(
                layout,
                panel,
                'add',
                placement,
              );
            }),
          );
        }
      },

      /**
       * Toggle the pin state of a panel.
       * @param panel - The panel to toggle the pin state of.
       */
      togglePanelPin: (panel: string) => {
        set((state) =>
          produce(state, (draft) => {
            const layout = draft.config.layout;
            const pinned = layout.pinned ?? [];
            if (pinned.includes(panel)) {
              layout.pinned = pinned.filter((p: string) => p !== panel);
            } else {
              layout.pinned = [...pinned, panel];
            }
          }),
        );
      },
    },
  }));
}

type RoomConfigWithLayout = BaseRoomConfig & LayoutSliceConfig;
type RoomStateWithLayout = RoomState<RoomConfigWithLayout> & LayoutSliceState;

export function useStoreWithLayout<T>(
  selector: (state: RoomStateWithLayout) => T,
): T {
  return useBaseRoomStore<
    BaseRoomConfig & LayoutSliceConfig,
    RoomState<RoomConfigWithLayout>,
    T
  >((state) => selector(state as unknown as RoomStateWithLayout));
}
