import {
  BaseProjectConfig,
  DEFAULT_MOSAIC_LAYOUT,
  createSlice,
} from '@sqlrooms/project';
import LayoutConfig, {MosaicLayoutConfig} from './LayoutConfig';
import {produce} from 'immer';
import {StateCreator} from 'zustand';
import {z} from 'zod';
import {makeMosaicStack, removeMosaicNodeByKey} from './mosaic';

/**
 * Configuration for the Layout slice
 */
export const LayoutSliceConfig = z.object({
  layout: z
    .object({
      // Add any persisted configuration here if needed
      // For example, cache settings, preferred data formats, etc.
    })
    .optional(),
});

export type LayoutSliceConfig = z.infer<typeof LayoutSliceConfig>;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return {
    layout: {},
  };
}

/**
 * State and actions for the Layout slice
 */
export type LayoutSliceState = {
  layout: {
    /**
     * Set the layout of the project.
     * @param layout - The layout to set.
     */
    setLayout(layout: LayoutConfig): void;
    /**
     * Toggle a panel.
     * @param panel - The panel to toggle.
     * @param show - Whether to show the panel.
     */
    togglePanel: (panel: string, show?: boolean) => void;
    /**
     * Toggle the pin state of a panel.
     * @param panel - The panel to toggle the pin state of.
     */
    togglePanelPin: (panel: string) => void;
    /**
     * Add or update a SQL query data source.
     * @param tableName - The name of the table to create or update.
     * @param query - The SQL query to execute.
     * @param oldTableName - The name of the table to replace (optional).
     */
  };
};

/**
 * Create a Layout slice for managing the connector
 */
export function createLayoutSlice<
  PC extends BaseProjectConfig & LayoutSliceConfig,
>({
  layout = DEFAULT_MOSAIC_LAYOUT,
}: {
  layout?: MosaicLayoutConfig;
}): StateCreator<LayoutSliceState> {
  return createSlice<PC, LayoutSliceState>((set, get) => ({
    layout: {
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
                layout.pinned = layout.pinned.filter((p) => p !== panel);
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
              const placement = draft.project.panels[panel]?.placement;
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
              layout.pinned = pinned.filter((p) => p !== panel);
            } else {
              layout.pinned = [...pinned, panel];
            }
          }),
        );
      },
    },
  }));
}
