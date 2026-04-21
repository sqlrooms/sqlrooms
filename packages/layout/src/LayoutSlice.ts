import {
  getLayoutNodeId,
  isLayoutNodeKey,
  isLayoutSplitNode,
  LayoutNode,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';
import {
  BaseRoomStoreState,
  createSlice,
  registerCommandsForOwner,
  unregisterCommandsForOwner,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {StateCreator} from 'zustand';
import {
  createLayoutPanelCommands,
  LAYOUT_COMMAND_OWNER,
} from './layout-commands';
import type {
  CreateLayoutSliceProps,
  LayoutSliceConfig,
  LayoutSliceState,
} from './layout-slice-types';
import {findNodeById, removeLayoutNodeByKey} from './layout-tree';
import {createTabActions} from './tab-actions';
import type {PanelDefinition} from './types';

// Re-export types for convenience
export {LayoutSliceConfig as LayoutSliceConfigSchema} from './layout-slice-types';
export type {CreateLayoutSliceProps, LayoutSliceConfig, LayoutSliceState};

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return MAIN_VIEW;
}

export function createLayoutSlice({
  config: initialConfig = createDefaultLayoutConfig(),
  panels = {},
}: CreateLayoutSliceProps = {}): StateCreator<LayoutSliceState> {
  return createSlice<LayoutSliceState, BaseRoomStoreState & LayoutSliceState>(
    (set, get, store) => {
      let unsubscribePanelChanges: (() => void) | undefined;
      const registerPanelCommands = () => {
        const panelCommands = createLayoutPanelCommands(get().layout.panels);
        registerCommandsForOwner(store, LAYOUT_COMMAND_OWNER, panelCommands);
      };

      // Create tab/collapse actions from factory
      const tabActions = createTabActions(set, get);

      return {
        layout: {
          initialize: async () => {
            registerPanelCommands();
            unsubscribePanelChanges?.();
            unsubscribePanelChanges = store.subscribe((state, prevState) => {
              if (state.layout.panels !== prevState.layout.panels) {
                registerPanelCommands();
              }
            });
          },
          destroy: async () => {
            unsubscribePanelChanges?.();
            unsubscribePanelChanges = undefined;
            unregisterCommandsForOwner(store, LAYOUT_COMMAND_OWNER);
          },
          config: initialConfig,
          panels,
          setConfig: (config) =>
            set((state) =>
              produce(state, (draft) => {
                draft.layout.config = config;
              }),
            ),
          setLayout: (layout) => get().layout.setConfig(layout),

          // ---------------------------------------------------------------
          // Deprecated panel toggle (kept for backward compat)
          // ---------------------------------------------------------------
          togglePanel: (panel, show) => {
            if (get().layout.config === panel) {
              return;
            }
            const result = removeLayoutNodeByKey(get().layout.config, panel);
            const isShown = result.success;
            if (isShown) {
              if (show || panel === MAIN_VIEW) {
                return;
              }
              set((state) =>
                produce(state, (draft) => {
                  draft.layout.config = result.nextTree;
                }),
              );
            } else {
              if (show === false) {
                return;
              }
              set((state) =>
                produce(state, (draft) => {
                  const root = draft.layout.config;
                  const panelDef = draft.layout.panels[panel];
                  const panelInfo =
                    typeof panelDef === 'function'
                      ? panelDef({panelId: panel})
                      : panelDef;
                  const placement = panelInfo?.placement;
                  const side = placement === 'sidebar' ? 'first' : 'second';
                  const childIdx = isLayoutSplitNode(root)
                    ? side === 'first'
                      ? 0
                      : root.children.length - 1
                    : -1;
                  const toReplace = isLayoutSplitNode(root)
                    ? root.children[childIdx]
                    : undefined;
                  if (
                    toReplace &&
                    typeof toReplace === 'string' &&
                    isLayoutSplitNode(root) &&
                    toReplace !== MAIN_VIEW
                  ) {
                    root.children[childIdx] = panel;
                  } else {
                    const newPanelNode: LayoutNode = {
                      type: 'panel',
                      id: panel,
                      defaultSize: '25%',
                    };
                    const existingLayout =
                      draft.layout.config &&
                      !isLayoutNodeKey(draft.layout.config)
                        ? {
                            ...draft.layout.config,
                            defaultSize: '75%',
                          }
                        : draft.layout.config;
                    draft.layout.config = {
                      type: 'split',
                      id: 'root-layout',
                      direction:
                        placement === 'sidebar-bottom' ? 'column' : 'row',
                      children:
                        side === 'first'
                          ? [newPanelNode, existingLayout ?? MAIN_VIEW]
                          : [existingLayout ?? MAIN_VIEW, newPanelNode],
                    };
                  }
                }),
              );
            }
          },

          togglePanelPin: () => {
            // No-op: pinned/fixed have been removed
          },

          // ---------------------------------------------------------------
          // Tab/collapse actions from factory
          // ---------------------------------------------------------------
          ...tabActions,

          registerPanel: (panelId: string, info: PanelDefinition) => {
            set((state) =>
              produce(state, (draft) => {
                draft.layout.panels[panelId] = info;
              }),
            );
          },

          unregisterPanel: (panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                delete draft.layout.panels[panelId];
              }),
            );
          },

          addChildToSplit: (splitId: string, panelId: LayoutNode) => {
            set((state) =>
              produce(state, (draft) => {
                const result = findNodeById(draft.layout.config, splitId);
                if (!result || !isLayoutSplitNode(result.node)) return;
                const newNodeId = getLayoutNodeId(panelId);
                const alreadyExists = result.node.children.some(
                  (child) => getLayoutNodeId(child) === newNodeId,
                );
                if (!alreadyExists) {
                  result.node.children.push(panelId);
                }
              }),
            );
          },

          findAncestorOfType: (nodeId, type) => {
            const config = get().layout.config;

            // Find the starting node and its ancestors (including panels)
            const found = findNodeById(config, nodeId);
            if (!found) {
              return undefined;
            }

            // Walk backwards through ancestors to find the first match
            for (let i = found.ancestors.length - 1; i >= 0; i--) {
              const ancestor = found.ancestors[i];

              // Check if this ancestor matches the requested type
              if (
                ancestor &&
                !isLayoutNodeKey(ancestor) &&
                type === ancestor.type
              ) {
                return ancestor;
              }
            }

            return undefined;
          },
        },
      };
    },
  );
}

export function useStoreWithLayout<T>(
  selector: (state: LayoutSliceState) => T,
): T {
  return useBaseRoomStore<LayoutSliceState, T>((state) => selector(state));
}
