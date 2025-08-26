import {
  RoomState,
  createBaseSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {produce} from 'immer';
import {z} from 'zod';
import {makeMosaicStack, removeMosaicNodeByKey} from './mosaic';
import React from 'react';
import {StateCreator} from 'zustand';
import {
  LayoutConfig,
  DEFAULT_MOSAIC_LAYOUT,
  MAIN_VIEW,
  isMosaicLayoutParent,
} from '@sqlrooms/layout-config';
import type {MosaicPath} from 'react-mosaic-component';

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'main' | 'top-bar';
};

export type PanelBehavior = {
  canToggle: boolean; // Whether this panel can be toggled on/off
  isFixed: boolean; // Whether this panel is always visible and can't be moved
  toggleTargetPath?: MosaicPath; // Preferred mosaic path location when showing
};

export const LayoutSliceConfigSchema = z.object({
  layout: z
    .any()
    .describe('Mosaic layout configuration.')
    .default(DEFAULT_MOSAIC_LAYOUT),
  panelBehaviors: z
    .record(
      z.string(),
      z.object({
        canToggle: z.boolean(),
        isFixed: z.boolean(),
        toggleTargetPath: z
          .array(z.union([z.literal('first'), z.literal('second')]))
          .optional(),
      }),
    )
    .describe('Configuration for panel behavior.')
    .default({}),
});

export type LayoutSliceConfig = z.infer<typeof LayoutSliceConfigSchema>;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return {
    layout: DEFAULT_MOSAIC_LAYOUT,
    panelBehaviors: {},
  };
}

export type LayoutSliceState = {
  layout: {
    panels: Record<string, RoomPanelInfo>;
    panelBehaviors: Record<string, PanelBehavior>;
    setLayout(layout: LayoutConfig): void;
    setPanelBehaviors(behaviors: Record<string, PanelBehavior>): void;
    togglePanel: (panel: string, show?: boolean) => void;
    togglePanelPin: (panel: string) => void;
    getPanelBehaviors(): Record<string, PanelBehavior>;
    canPanelToggle(panel: string): boolean;
    isPanelFixed(panel: string): boolean;
  };
};

export function createLayoutSlice<
  PC extends BaseRoomConfig & LayoutSliceConfig,
>({
  panels = {},
  panelBehaviors = {},
}: {
  panels?: Record<string, RoomPanelInfo>;
  panelBehaviors?: Record<string, PanelBehavior>;
} = {}): StateCreator<LayoutSliceState> {
  return createBaseSlice<PC, LayoutSliceState>((set, get) => ({
    layout: {
      panels,
      panelBehaviors,
      setLayout: (layout) =>
        set((state) =>
          produce(state, (draft) => {
            draft.config.layout = layout;
          }),
        ),
      setPanelBehaviors: (behaviors) =>
        set((state) =>
          produce(state, (draft) => {
            draft.config.panelBehaviors = behaviors;
            draft.layout.panelBehaviors = behaviors;
          }),
        ),
      togglePanel: (panel, show) => {
        const {config} = get();
        if (config.layout?.nodes === panel) {
          // don't hide the view if it's the only one
          return;
        }

        // Check if panel can be toggled
        if (!get().layout.canPanelToggle(panel)) {
          console.warn(`Panel ${panel} cannot be toggled`);
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
              layout.nodes = result.nextTree;
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
              const root = layout.nodes;
              const placement = get().layout.panels[panel]?.placement;

              // Get the panel's configured behavior
              const panelConfig = get().layout.panelBehaviors[panel];

              // Use react-mosaic's native concepts for placement
              const side = placement === 'sidebar' ? 'first' : 'second';

              // If a toggleTargetPath is provided, attempt to place at that path
              const targetPath = panelConfig?.toggleTargetPath;
              if (
                targetPath &&
                Array.isArray(targetPath) &&
                targetPath.length > 0
              ) {
                try {
                  let current = root;
                  let pathValid = true;
                  for (let i = 0; i < targetPath.length - 1; i++) {
                    const seg = targetPath[i];
                    if (
                      (seg === 'first' || seg === 'second') &&
                      isMosaicLayoutParent(current)
                    ) {
                      current = (current as any)[seg];
                    } else {
                      pathValid = false;
                      break;
                    }
                  }
                  if (pathValid && isMosaicLayoutParent(current)) {
                    const last = targetPath[targetPath.length - 1];
                    if (last === 'first' || last === 'second') {
                      const targetNode = (current as any)[last];
                      if (
                        targetNode &&
                        !isMosaicLayoutParent(targetNode) &&
                        targetNode !== MAIN_VIEW &&
                        !layout.fixed?.includes(targetNode) &&
                        !layout.pinned?.includes(targetNode)
                      ) {
                        (current as any)[last] = panel;
                        return;
                      }
                    }
                  }
                } catch (err) {
                  // fall through to default logic
                }
              }

              // fallback to old logic for backwards compatibility
              const toReplace = isMosaicLayoutParent(root)
                ? root[side]
                : undefined;

              if (
                toReplace &&
                isMosaicLayoutParent(root) &&
                !isMosaicLayoutParent(toReplace) &&
                toReplace !== MAIN_VIEW &&
                !layout.fixed?.includes(toReplace) &&
                !layout.pinned?.includes(toReplace)
              ) {
                // replace first un-pinned leaf
                root[side] = panel;
              } else {
                // Use simple stacking with default weights
                const panelNode = {node: panel, weight: 1};
                const restNode = {
                  node: config.layout?.nodes,
                  weight: 3,
                };

                // Create stack using react-mosaic's native makeMosaicStack
                layout.nodes = makeMosaicStack(
                  placement === 'sidebar-bottom' ? 'column' : 'row',
                  side === 'first'
                    ? [panelNode, restNode]
                    : [restNode, panelNode],
                );
              }
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
      getPanelBehaviors: () => {
        return get().layout.panelBehaviors;
      },
      canPanelToggle: (panel: string) => {
        const config = get().layout.panelBehaviors[panel];
        return config ? config.canToggle : true; // Default to true if no config
      },
      isPanelFixed: (panel: string) => {
        const config = get().layout.panelBehaviors[panel];
        return config ? config.isFixed : false; // Default to false if no config
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
