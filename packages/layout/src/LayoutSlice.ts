import {
  DEFAULT_MOSAIC_LAYOUT,
  isMosaicLayoutSplitNode,
  LayoutConfig,
  MAIN_VIEW,
  MosaicLayoutTabsNode,
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
import {z} from 'zod';
import {StateCreator} from 'zustand';
import {
  findAreaById,
  findParentSplit,
  makeMosaicStack,
  removeMosaicNodeByKey,
} from './mosaic';

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

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  /** @deprecated Use `area` instead */
  placement?: 'sidebar' | 'sidebar-bottom' | 'main' | string;
  /** Named area this panel belongs to (e.g. 'left', 'main', 'bottom') */
  area?: string;
};

export const LayoutSliceConfig = LayoutConfig;

export type LayoutSliceConfig = z.infer<typeof LayoutSliceConfig>;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return DEFAULT_MOSAIC_LAYOUT;
}

export type LayoutSliceState = {
  layout: {
    initialize?: () => Promise<void>;
    destroy?: () => Promise<void>;
    config: LayoutSliceConfig;
    panels: Record<string, RoomPanelInfo>;
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
  };
};

export type CreateLayoutSliceProps = {
  config?: LayoutSliceConfig;
  panels?: Record<string, RoomPanelInfo>;
};

const COLLAPSE_MIN_PERCENT = 0;

function findAreaInConfig(
  config: LayoutSliceConfig,
  areaId: string,
): {node: MosaicLayoutTabsNode; path: number[]} | undefined {
  return findAreaById(config.nodes, areaId);
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
            if (get().layout.config?.nodes === panel) {
              return;
            }
            const result = removeMosaicNodeByKey(
              get().layout.config?.nodes,
              panel,
            );
            const isShown = result.success;
            if (isShown) {
              if (show || panel === MAIN_VIEW) {
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
                  const panelInfo = draft.layout.panels[panel];
                  const placement = panelInfo?.area ?? panelInfo?.placement;
                  const side = placement === 'sidebar' ? 'first' : 'second';
                  const childIdx = isMosaicLayoutSplitNode(root)
                    ? side === 'first'
                      ? 0
                      : root.children.length - 1
                    : -1;
                  const toReplace = isMosaicLayoutSplitNode(root)
                    ? root.children[childIdx]
                    : undefined;
                  if (
                    toReplace &&
                    typeof toReplace === 'string' &&
                    isMosaicLayoutSplitNode(root) &&
                    toReplace !== MAIN_VIEW &&
                    !layout.fixed?.includes(toReplace) &&
                    !layout.pinned?.includes(toReplace)
                  ) {
                    root.children[childIdx] = panel;
                  } else {
                    const panelNode = {node: panel, weight: 1};
                    const restNode = {
                      node: draft.layout.config?.nodes,
                      weight: 3,
                    };
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

          // ---------------------------------------------------------------
          // New area-aware API
          // ---------------------------------------------------------------

          setActivePanel: (areaId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found) return;
                const idx = found.node.tabs.indexOf(panelId);
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
                if (!found.node.tabs.includes(panelId)) {
                  found.node.tabs.push(panelId);
                }
                found.node.activeTabIndex = found.node.tabs.indexOf(panelId);
              }),
            );
          },

          removePanelFromArea: (areaId: string, panelId: string) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found) return;
                const idx = found.node.tabs.indexOf(panelId);
                if (idx < 0) return;
                if (found.node.tabs.length <= 1) return;
                found.node.tabs.splice(idx, 1);
                if (found.node.activeTabIndex >= found.node.tabs.length) {
                  found.node.activeTabIndex = found.node.tabs.length - 1;
                }
              }),
            );
          },

          setAreaCollapsed: (areaId: string, collapsed: boolean) => {
            set((state) =>
              produce(state, (draft) => {
                const found = findAreaInConfig(draft.layout.config, areaId);
                if (!found || !found.node.collapsible) return;

                const parentSplit = findParentSplit(
                  draft.layout.config.nodes,
                  found.path,
                );
                if (!parentSplit) return;

                const minPercent = COLLAPSE_MIN_PERCENT;

                if (collapsed && !found.node.collapsed) {
                  found.node.savedPercentages = parentSplit.node
                    .splitPercentages
                    ? [...parentSplit.node.splitPercentages]
                    : undefined;
                  const childCount = parentSplit.node.children.length;
                  const newPercentages = parentSplit.node.splitPercentages
                    ? [...parentSplit.node.splitPercentages]
                    : Array(childCount).fill(Math.round(100 / childCount));
                  const collapsedAmount =
                    newPercentages[parentSplit.childIndex]! - minPercent;
                  newPercentages[parentSplit.childIndex] = minPercent;
                  const remainingIndices = Array.from(
                    {length: childCount},
                    (_, i) => i,
                  ).filter((i) => i !== parentSplit.childIndex);
                  const remainingTotal = remainingIndices.reduce(
                    (sum, i) => sum + newPercentages[i]!,
                    0,
                  );
                  for (const i of remainingIndices) {
                    newPercentages[i] = Math.round(
                      (newPercentages[i]! / remainingTotal) *
                        (remainingTotal + collapsedAmount),
                    );
                  }
                  parentSplit.node.splitPercentages = newPercentages;
                  found.node.collapsed = true;
                } else if (!collapsed && found.node.collapsed) {
                  if (found.node.savedPercentages) {
                    parentSplit.node.splitPercentages =
                      found.node.savedPercentages;
                    found.node.savedPercentages = undefined;
                  } else {
                    const childCount = parentSplit.node.children.length;
                    parentSplit.node.splitPercentages = Array(childCount).fill(
                      Math.round(100 / childCount),
                    );
                  }
                  found.node.collapsed = false;
                }
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
            return found ? [...found.node.tabs] : [];
          },

          getActivePanel: (areaId: string): string | undefined => {
            const found = findAreaInConfig(get().layout.config, areaId);
            if (!found) return undefined;
            return found.node.tabs[found.node.activeTabIndex];
          },

          isAreaCollapsed: (areaId: string): boolean => {
            const found = findAreaInConfig(get().layout.config, areaId);
            return found?.node.collapsed === true;
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
      const panelInfo = getState().layout.panels[panelId];
      const areaId = panelInfo?.area ?? panelInfo?.placement;
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
      const areaId = panelInfo.area ?? panelInfo.placement;
      const keywords = [
        panelId,
        panelInfo.title,
        panelInfo.area,
        panelInfo.placement,
      ].filter((value): value is string => Boolean(value));
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

  // --- Area commands ---

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
