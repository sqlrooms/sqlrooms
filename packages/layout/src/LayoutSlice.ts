import {
  isLayoutMosaicNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutConfig,
  LayoutNode,
  LayoutSplitNode,
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
import {MosaicNode} from 'react-mosaic-component';
import {StateCreator} from 'zustand';
import {
  findNodeById,
  findAnyNodeById,
  makeLayoutStack,
  removeLayoutNodeByKey,
  IdentifiedLayoutNode,
} from './mosaic/mosaic-utils';
import type {Panels, RoomPanelInfo} from './types';
import {getPanelId} from './node-renderers/types';
import {createTabActions} from './tab-actions';
import {
  createLayoutPanelCommands,
  LAYOUT_COMMAND_OWNER,
} from './layout-commands';

// ---------------------------------------------------------------------------
// Config types — LayoutConfig is now LayoutNode | null directly
// ---------------------------------------------------------------------------

export const LayoutSliceConfig = LayoutConfig;
export type LayoutSliceConfig = LayoutConfig;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return MAIN_VIEW;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type LayoutSliceState = {
  layout: {
    initialize?: () => Promise<void>;
    destroy?: () => Promise<void>;
    config: LayoutSliceConfig;
    panels: Panels;
    setConfig(layout: LayoutConfig): void;
    /** @deprecated Use setConfig instead */
    setLayout(layout: LayoutConfig): void;

    /** @deprecated Use setActiveTab / addTab / removeTab instead */
    togglePanel: (panel: string, show?: boolean) => void;
    /** @deprecated */
    togglePanelPin: (panel: string) => void;

    /** Set the active (visible) tab in a tabs node */
    setActiveTab: (tabsId: string, tabId: string) => void;
    /** Add a tab to a tabs node */
    addTab: (tabsId: string, tabIdOrNode: string | LayoutNode) => void;
    /** Remove (close) a tab from a tabs node */
    removeTab: (tabsId: string, tabId: string) => void;
    /** Collapse or expand a collapsible node */
    setCollapsed: (id: string, collapsed: boolean) => void;
    /** Toggle collapse state of a collapsible node */
    toggleCollapsed: (id: string) => void;
    /** Get the list of all tab IDs in a tabs node (both visible and hidden) */
    getTabs: (tabsId: string) => string[];
    /** Get the list of visible tab IDs in a tabs node */
    getVisibleTabs: (tabsId: string) => string[];
    /** Get the list of hidden tab IDs in a tabs node */
    getHiddenTabs: (tabsId: string) => string[];
    /** Get the active tab ID in a tabs node */
    getActiveTab: (tabsId: string) => string | undefined;
    /** Check if a node is currently collapsed */
    isCollapsed: (id: string) => boolean;

    /** @deprecated Use setActiveTab instead */
    setActivePanel: (areaId: string, panelId: string) => void;
    /** @deprecated Use addTab instead */
    addPanelToArea: (areaId: string, panelId: string) => void;
    /** @deprecated Use removeTab instead */
    removePanelFromArea: (areaId: string, panelId: string) => void;
    /** @deprecated Use setCollapsed instead */
    setAreaCollapsed: (areaId: string, collapsed: boolean) => void;
    /** @deprecated Use toggleCollapsed instead */
    toggleAreaCollapsed: (areaId: string) => void;
    /** @deprecated Use getTabs instead */
    getAreaPanels: (areaId: string) => string[];
    /** @deprecated Use getActiveTab instead */
    getActivePanel: (areaId: string) => string | undefined;
    /** @deprecated Use isCollapsed instead */
    isAreaCollapsed: (areaId: string) => boolean;
    /** Register a panel dynamically (adds to panels registry) */
    registerPanel: (panelId: string, info: RoomPanelInfo) => void;
    /** Unregister a dynamically added panel */
    unregisterPanel: (panelId: string) => void;
    /** Add a panel as a child of a named split node */
    addChildToSplit: (splitId: string, panelId: string) => void;
    /** Add a panel as a child of a named nested mosaic node */
    addChildToMosaic: (mosaicId: string, panelId: string) => void;
    /** Find the nearest ancestor of a given type for a node */
    findAncestorOfType: (
      nodeId: string,
      type: 'tabs' | 'split' | 'mosaic',
    ) => IdentifiedLayoutNode | undefined;
  };
};

export type CreateLayoutSliceProps = {
  config?: LayoutSliceConfig;
  panels?: Panels;
};

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
                  const panelInfo = draft.layout.panels[panel];
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
                    const panelNode = {node: panel, weight: 1};
                    const restNode = {
                      node: draft.layout.config as MosaicNode<string> | null,
                      weight: 3,
                    };
                    draft.layout.config = makeLayoutStack(
                      placement === 'sidebar-bottom' ? 'column' : 'row',
                      side === 'first'
                        ? [panelNode, restNode]
                        : [restNode, panelNode],
                    ) as LayoutNode | null;
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

          // Deprecated aliases
          setActivePanel: (...args) => get().layout.setActiveTab(...args),
          addPanelToArea: (...args) => get().layout.addTab(...args),
          removePanelFromArea: (...args) => get().layout.removeTab(...args),
          setAreaCollapsed: (...args) => get().layout.setCollapsed(...args),
          toggleAreaCollapsed: (...args) =>
            get().layout.toggleCollapsed(...args),
          getAreaPanels: (...args) => get().layout.getTabs(...args),
          getActivePanel: (...args) => get().layout.getActiveTab(...args),
          isAreaCollapsed: (...args) => get().layout.isCollapsed(...args),

          registerPanel: (panelId: string, info: RoomPanelInfo) => {
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
                if (!result.node.children.includes(panelId)) {
                  result.node.children.push(panelId);
                }
              }),
            );
          },

          addChildToMosaic: (mosaicId: string, panelId: LayoutNode) => {
            set((state) =>
              produce(state, (draft) => {
                const result = findNodeById(draft.layout.config, mosaicId);
                if (!result || !isLayoutMosaicNode(result.node)) return;

                const dir = result.node.direction ?? 'row';

                if (!result.node.nodes) {
                  result.node.nodes = panelId;
                } else if (typeof result.node.nodes === 'string') {
                  result.node.nodes = {
                    id: getPanelId(panelId),
                    type: 'split',
                    direction: dir,
                    children: [result.node.nodes, panelId],
                  };
                } else if (isLayoutSplitNode(result.node.nodes)) {
                  result.node.nodes.children.push(panelId);
                }
              }),
            );
          },

          findAncestorOfType: (
            nodeId: string,
            type: 'tabs' | 'split' | 'mosaic',
          ): IdentifiedLayoutNode | undefined => {
            const config = get().layout.config;
            if (!config) return undefined;

            // Find the starting node and its ancestors (including panels)
            const found = findAnyNodeById(config, nodeId);
            if (!found) return undefined;

            // Walk backwards through ancestors to find the first match
            for (let i = found.ancestors.length - 1; i >= 0; i--) {
              const ancestor = found.ancestors[i];

              if (!ancestor || typeof ancestor === 'string') continue;

              // Check if this ancestor matches the requested type
              if (type === 'tabs' && isLayoutTabsNode(ancestor)) {
                return ancestor;
              }
              if (type === 'split' && isLayoutSplitNode(ancestor)) {
                return ancestor as LayoutSplitNode & {id: string};
              }
              if (type === 'mosaic' && isLayoutMosaicNode(ancestor)) {
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
