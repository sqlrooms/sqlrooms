import {
  DEFAULT_MOSAIC_LAYOUT,
  LayoutConfig,
  MAIN_VIEW,
  isMosaicLayoutParent,
} from '@sqlrooms/layout-config';
import {
  SliceState,
  createBaseSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import React from 'react';
import {z} from 'zod';
import {StateCreator} from 'zustand';
import {makeMosaicStack, removeMosaicNodeByKey} from './mosaic';

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'main' | 'top-bar';
};

export const LayoutSliceConfig = LayoutConfig;

export type LayoutSliceConfig = z.infer<typeof LayoutSliceConfig>;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return DEFAULT_MOSAIC_LAYOUT;
}

export type LayoutSliceState = SliceState & {
  layout: {
    config: LayoutSliceConfig;
    panels: Record<string, RoomPanelInfo>;
    setConfig(layout: LayoutConfig): void;
    /** @deprecated Use setConfig instead */
    setLayout(layout: LayoutConfig): void;
    togglePanel: (panel: string, show?: boolean) => void;
    togglePanelPin: (panel: string) => void;
  };
};

export type CreateLayoutSliceProps = {
  config?: LayoutSliceConfig;
  panels?: Record<string, RoomPanelInfo>;
};

export function createLayoutSlice({
  config: initialConfig = createDefaultLayoutConfig(),
  panels = {},
}: CreateLayoutSliceProps = {}): StateCreator<LayoutSliceState> {
  return createBaseSlice<LayoutSliceState>((set, get) => ({
    layout: {
      config: initialConfig,
      panels,
      setConfig: (config) =>
        set((state) =>
          produce(state, (draft) => {
            draft.layout.config = config;
          }),
        ),
      setLayout: (layout) => get().layout.setConfig(layout),
      togglePanel: (panel, show) => {
        if (get().layout.config?.nodes === panel) {
          // don't hide the view if it's the only one
          return;
        }
        const result = removeMosaicNodeByKey(get().layout.config?.nodes, panel);
        const isShown = result.success;
        if (isShown) {
          if (show || panel === MAIN_VIEW /*&& areViewsReadyToRender()*/) {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              const layout = draft.layout.config;
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
              const layout = draft.layout.config;
              const root = layout.nodes;
              const placement = draft.layout.panels[panel]?.placement;
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
                  node: draft.layout.config?.nodes,
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
            const layout = draft.layout.config;
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

export function useStoreWithLayout<T>(
  selector: (state: LayoutSliceState) => T,
): T {
  return useBaseRoomStore<LayoutSliceState, T>((state) => selector(state));
}
