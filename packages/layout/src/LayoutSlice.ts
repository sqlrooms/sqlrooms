import {
  RoomState,
  createBaseSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {
  BaseRoomConfig,
  DEFAULT_MOSAIC_LAYOUT,
  LayoutConfig,
  MAIN_VIEW,
  isMosaicLayoutParent,
} from '@sqlrooms/room-config';
import {produce} from 'immer';
import {z} from 'zod';
import {makeMosaicStack, removeMosaicNodeByKey} from './mosaic';
import React from 'react';
import {StateCreator} from 'zustand';

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'main' | 'top-bar';
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
              const side = placement === 'sidebar' ? 'first' : 'second';
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
                const panelNode = {node: panel, weight: 1};
                const restNode = {
                  node: config.layout?.nodes,
                  weight: 3,
                };
                // add to to the left
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
