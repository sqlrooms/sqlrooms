import {
  isLayoutSplitNode,
  LayoutConfig,
  LayoutNode,
  LayoutTabsNode,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';
import {
  BaseRoomStoreState,
  createSlice,
  registerCommandsForOwner,
  RoomCommand,
  unregisterCommandsForOwner,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import React from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {z} from 'zod';
import {StateCreator} from 'zustand';
import {
  findAreaById,
  findAreaForPanel,
  findMosaicNodeById,
  findSplitById,
  getChildKey,
  makeLayoutStack,
  removeLayoutNodeByKey,
} from './mosaic/mosaic-utils';

const LAYOUT_COMMAND_OWNER = '@sqlrooms/layout/panels';
const ToggleLayoutPanelCommandInput = z.object({
  panelId: z
    .string()
    .describe('ID of the panel to show/hide, e.g. "sql-editor".'),
  show: z
    .boolean()
    .optional()
    .describe(
      'Optional explicit visibility. True shows, false hides, omitted toggles.',
    ),
});
type ToggleLayoutPanelCommandInput = z.infer<
  typeof ToggleLayoutPanelCommandInput
>;

const AreaSetActivePanelInput = z.object({
  areaId: z.string().describe('ID of the area.'),
  panelId: z.string().describe('ID of the panel to make active.'),
});
type AreaSetActivePanelInput = z.infer<typeof AreaSetActivePanelInput>;

const AreaCollapseInput = z.object({
  areaId: z.string().describe('ID of the area to collapse/expand.'),
  collapsed: z.boolean().describe('True to collapse, false to expand.'),
});
type AreaCollapseInput = z.infer<typeof AreaCollapseInput>;

const AreaAddPanelInput = z.object({
  areaId: z.string().describe('ID of the area.'),
  panelId: z.string().describe('ID of the panel to add.'),
});
type AreaAddPanelInput = z.infer<typeof AreaAddPanelInput>;

const AreaRemovePanelInput = z.object({
  areaId: z.string().describe('ID of the area.'),
  panelId: z.string().describe('ID of the panel to remove.'),
});
type AreaRemovePanelInput = z.infer<typeof AreaRemovePanelInput>;

// ---------------------------------------------------------------------------
// Render callback types
// ---------------------------------------------------------------------------

/** Path segments use node IDs when available, numeric indices otherwise. */
export type LayoutPath = (string | number)[];

export type PanelRenderContext = {
  panelId: string;
  containerType: 'tabs' | 'mosaic' | 'split' | 'root';
  containerId?: string;
  path: LayoutPath;
};

export type TabStripRenderContext = {
  node: LayoutTabsNode;
  path: LayoutPath;
};

// ---------------------------------------------------------------------------
// Panel info
// ---------------------------------------------------------------------------

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component?: React.ComponentType<Partial<PanelRenderContext>>;
  /** Render function for dynamic panels — takes priority over component */
  render?: (context: PanelRenderContext) => React.ReactNode;
  /**
   * Resolve metadata and/or render function for descendant panels
   * that aren't in the static panels registry. The renderer walks up
   * the path and calls the first ancestor's resolveChild it finds.
   */
  resolveChild?: (context: PanelRenderContext) => RoomPanelInfo | undefined;
  /** @deprecated No longer used — panel area is determined by the layout tree */
  placement?: 'sidebar' | 'sidebar-bottom' | 'main' | string;
};

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
    panels: Record<string, RoomPanelInfo>;
    renderTabStrip?: (
      context: TabStripRenderContext,
    ) => React.ReactNode | undefined;
    setConfig(layout: LayoutConfig): void;
    /** @deprecated Use setConfig instead */
    setLayout(layout: LayoutConfig): void;

    /** @deprecated Use setActivePanel / addPanelToArea / removePanelFromArea instead */
    togglePanel: (panel: string, show?: boolean) => void;
    /** @deprecated */
    togglePanelPin: (panel: string) => void;

    /** Set the active (visible) panel in a named area */
    setActivePanel: (areaId: string, panelId: string) => void;
    /** Add a panel as a new tab in a named area */
    addPanelToArea: (areaId: string, panelId: string) => void;
    /** Remove a panel tab from its area */
    removePanelFromArea: (areaId: string, panelId: string) => void;
    /** Collapse or expand a named area */
    setAreaCollapsed: (areaId: string, collapsed: boolean) => void;
    /** Toggle collapse state of a named area */
    toggleAreaCollapsed: (areaId: string) => void;
    /** Get the list of panel IDs in a named area */
    getAreaPanels: (areaId: string) => string[];
    /** Get the active panel ID in a named area */
    getActivePanel: (areaId: string) => string | undefined;
    /** Check if a named area is currently collapsed */
    isAreaCollapsed: (areaId: string) => boolean;
    /** Register a panel dynamically (adds to panels registry) */
    registerPanel: (panelId: string, info: RoomPanelInfo) => void;
    /** Unregister a dynamically added panel */
    unregisterPanel: (panelId: string) => void;
    /** Add a panel as a child of a named split node */
    addChildToSplit: (splitId: string, panelId: string) => void;
    /** Add a panel as a child of a named nested mosaic node */
    addChildToMosaic: (mosaicId: string, panelId: string) => void;
  };
};

export type CreateLayoutSliceProps = {
  config?: LayoutSliceConfig;
  panels?: Record<string, RoomPanelInfo>;
  renderTabStrip?: (
    context: TabStripRenderContext,
  ) => React.ReactNode | undefined;
};

function findAreaInConfig(
  config: LayoutSliceConfig,
  areaId: string,
): {node: LayoutTabsNode; path: number[]} | undefined {
  return findAreaById(config, areaId);
}

export function createLayoutSlice({
  config: initialConfig = createDefaultLayoutConfig(),
  panels = {},
  renderTabStrip,
}: CreateLayoutSliceProps = {}): StateCreator<LayoutSliceState> {
  return createSlice<LayoutSliceState, BaseRoomStoreState & LayoutSliceState>(
    (set, get, store) => {
      let unsubscribePanelChanges: (() => void) | undefined;
      const registerPanelCommands = () => {
        const panelCommands = createLayoutPanelCommands(get().layout.panels);
        registerCommandsForOwner(store, LAYOUT_COMMAND_OWNER, panelCommands);
      };

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
          renderTabStrip,
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
          // Area-aware API
          // ---------------------------------------------------------------

          setActivePanel: (areaId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found) return;
                let idx = found.node.children.findIndex(
                  (c) => getChildKey(c) === panelId,
                );
                if (idx < 0) {
                  if (found.node.closedChildren) {
                    const closedIdx =
                      found.node.closedChildren.indexOf(panelId);
                    if (closedIdx >= 0) {
                      found.node.closedChildren.splice(closedIdx, 1);
                      found.node.children.push(panelId);
                      idx = found.node.children.length - 1;
                    }
                  }
                }
                if (idx >= 0) {
                  found.node.activeTabIndex = idx;
                }
              }),
            );
            if (get().layout.isAreaCollapsed(areaId)) {
              get().layout.setAreaCollapsed(areaId, false);
            }
          },

          addPanelToArea: (areaId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found) return;
                if (
                  !found.node.children.some((c) => getChildKey(c) === panelId)
                ) {
                  found.node.children.push(panelId);
                }
                found.node.activeTabIndex = found.node.children.findIndex(
                  (c) => getChildKey(c) === panelId,
                );
                if (found.node.closedChildren) {
                  const closedIdx = found.node.closedChildren.indexOf(panelId);
                  if (closedIdx >= 0) {
                    found.node.closedChildren.splice(closedIdx, 1);
                  }
                }
              }),
            );
          },

          removePanelFromArea: (areaId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found) return;
                const idx = found.node.children.findIndex(
                  (c) => getChildKey(c) === panelId,
                );
                if (idx < 0) return;
                if (found.node.children.length <= 1) return;
                found.node.children.splice(idx, 1);
                if (found.node.activeTabIndex >= found.node.children.length) {
                  found.node.activeTabIndex = found.node.children.length - 1;
                }
                if (!found.node.closedChildren) {
                  found.node.closedChildren = [];
                }
                if (!found.node.closedChildren.includes(panelId)) {
                  found.node.closedChildren.push(panelId);
                }
              }),
            );
          },

          setAreaCollapsed: (areaId: string, collapsed: boolean) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found || !found.node.collapsible) return;
                found.node.collapsed = collapsed;
              }),
            );
          },

          toggleAreaCollapsed: (areaId: string) => {
            const found = findAreaInConfig(get().layout.config, areaId);
            if (!found) return;
            get().layout.setAreaCollapsed(areaId, !found.node.collapsed);
          },

          getAreaPanels: (areaId: string): string[] => {
            const found = findAreaInConfig(get().layout.config, areaId);
            if (!found) return [];
            const ids = found.node.children
              .map((c) => getChildKey(c))
              .filter((k): k is string => k != null);
            if (found.node.closedChildren) {
              for (const id of found.node.closedChildren) {
                if (!ids.includes(id)) ids.push(id);
              }
            }
            return ids;
          },

          getActivePanel: (areaId: string): string | undefined => {
            const found = findAreaInConfig(get().layout.config, areaId);
            if (!found) return undefined;
            const child = found.node.children[found.node.activeTabIndex];
            return child != null ? getChildKey(child) : undefined;
          },

          isAreaCollapsed: (areaId: string): boolean => {
            const found = findAreaInConfig(get().layout.config, areaId);
            return found?.node.collapsed === true;
          },

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

          addChildToSplit: (splitId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findSplitById(draft.layout.config, splitId);
                if (!found) return;
                if (!found.node.children.includes(panelId)) {
                  found.node.children.push(panelId);
                }
              }),
            );
          },

          addChildToMosaic: (mosaicId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findMosaicNodeById(draft.layout.config, mosaicId);
                if (!found) return;
                const nodes = found.nodes;
                const dir = found.direction ?? 'row';
                if (!nodes) {
                  found.nodes = panelId;
                } else if (typeof nodes === 'string') {
                  found.nodes = {
                    type: 'split',
                    direction: dir,
                    children: [nodes, panelId],
                  };
                } else if (isLayoutSplitNode(nodes)) {
                  nodes.children.push(panelId);
                }
              }),
            );
          },
        },
      };
    },
  );
}

type LayoutCommandStoreState = BaseRoomStoreState & LayoutSliceState;

function createLayoutPanelCommands(
  panels: Record<string, RoomPanelInfo>,
): RoomCommand<LayoutCommandStoreState>[] {
  const byIdCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.panel.show',
    name: 'Show panel by ID',
    description: 'Activate a panel in its area (expands the area if collapsed)',
    group: 'Layout',
    keywords: ['layout', 'panel', 'show', 'activate', 'open', 'id'],
    inputSchema: ToggleLayoutPanelCommandInput,
    inputDescription: 'Provide panelId to activate it in its area.',
    metadata: {
      readOnly: false,
      idempotent: true,
      riskLevel: 'low',
    },
    validateInput: (input, {getState}) => {
      const {panelId} = input as ToggleLayoutPanelCommandInput;
      if (!getState().layout.panels[panelId]) {
        throw new Error(`Unknown panel ID "${panelId}".`);
      }
    },
    execute: ({getState}, input) => {
      const {panelId} = input as ToggleLayoutPanelCommandInput;
      const areaId = findAreaForPanel(getState().layout.config, panelId);
      if (areaId) {
        getState().layout.setActivePanel(areaId, panelId);
      }
      return {
        success: true,
        commandId: 'layout.panel.show',
        message: `Activated panel "${panelId}"${areaId ? ` in area "${areaId}"` : ''}.`,
      };
    },
  };

  const panelShortcutCommands: RoomCommand<LayoutCommandStoreState>[] =
    Object.entries(panels).map(([panelId, panelInfo]) => {
      const title = panelInfo.title ?? panelId;
      const keywords = [panelId, panelInfo.title].filter(
        (value): value is string => Boolean(value),
      );
      return {
        id: `layout.panel.show.${panelId}`,
        name: `Show panel: ${title}`,
        description: `Activate the ${title} panel in its area`,
        group: 'Layout',
        keywords,
        metadata: {
          readOnly: false,
          idempotent: true,
          riskLevel: 'low',
        },
        execute: ({getState}) => {
          const areaId = findAreaForPanel(getState().layout.config, panelId);
          if (areaId) {
            getState().layout.setActivePanel(areaId, panelId);
          }
          return {
            success: true,
            commandId: `layout.panel.show.${panelId}`,
            message: `Activated panel "${panelId}".`,
          };
        },
      };
    });

  const setActivePanelCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.area.set-active',
    name: 'Set active panel in area',
    description: 'Set which panel is visible in a named area',
    group: 'Layout',
    keywords: ['layout', 'area', 'tab', 'active', 'panel', 'select'],
    inputSchema: AreaSetActivePanelInput,
    inputDescription: 'Provide areaId and panelId.',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, panelId} = input as AreaSetActivePanelInput;
      getState().layout.setActivePanel(areaId, panelId);
      return {
        success: true,
        commandId: 'layout.area.set-active',
        message: `Set active panel in "${areaId}" to "${panelId}".`,
      };
    },
  };

  const collapseAreaCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.area.collapse',
    name: 'Collapse or expand area',
    description: 'Collapse or expand a named layout area',
    group: 'Layout',
    keywords: ['layout', 'area', 'collapse', 'expand', 'toggle'],
    inputSchema: AreaCollapseInput,
    inputDescription: 'Provide areaId and collapsed (true/false).',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, collapsed} = input as AreaCollapseInput;
      getState().layout.setAreaCollapsed(areaId, collapsed);
      return {
        success: true,
        commandId: 'layout.area.collapse',
        message: `${collapsed ? 'Collapsed' : 'Expanded'} area "${areaId}".`,
      };
    },
  };

  const addPanelToAreaCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.area.add-panel',
    name: 'Add panel to area',
    description: 'Add a panel as a new tab in a named area',
    group: 'Layout',
    keywords: ['layout', 'area', 'add', 'panel', 'tab'],
    inputSchema: AreaAddPanelInput,
    inputDescription: 'Provide areaId and panelId.',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, panelId} = input as AreaAddPanelInput;
      getState().layout.addPanelToArea(areaId, panelId);
      return {
        success: true,
        commandId: 'layout.area.add-panel',
        message: `Added panel "${panelId}" to area "${areaId}".`,
      };
    },
  };

  const removePanelFromAreaCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.area.remove-panel',
    name: 'Remove panel from area',
    description: 'Remove a panel tab from a named area',
    group: 'Layout',
    keywords: ['layout', 'area', 'remove', 'panel', 'tab', 'close'],
    inputSchema: AreaRemovePanelInput,
    inputDescription: 'Provide areaId and panelId.',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, panelId} = input as AreaRemovePanelInput;
      getState().layout.removePanelFromArea(areaId, panelId);
      return {
        success: true,
        commandId: 'layout.area.remove-panel',
        message: `Removed panel "${panelId}" from area "${areaId}".`,
      };
    },
  };

  return [
    byIdCommand,
    ...panelShortcutCommands,
    setActivePanelCommand,
    collapseAreaCommand,
    addPanelToAreaCommand,
    removePanelFromAreaCommand,
  ];
}

export function useStoreWithLayout<T>(
  selector: (state: LayoutSliceState) => T,
): T {
  return useBaseRoomStore<LayoutSliceState, T>((state) => selector(state));
}
