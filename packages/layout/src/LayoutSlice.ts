import {
  DEFAULT_MOSAIC_LAYOUT,
  LayoutConfig,
  MAIN_VIEW,
  isMosaicLayoutSplitNode,
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
import {makeMosaicStack, removeMosaicNodeByKey} from './mosaic';

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

const ToggleLayoutPanelPinInput = z.object({
  panelId: z.string().describe('ID of the panel to pin/unpin.'),
});
type ToggleLayoutPanelPinInput = z.infer<typeof ToggleLayoutPanelPinInput>;

export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar' | 'sidebar-bottom' | 'main' | string;
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
          togglePanel: (panel, show) => {
            if (get().layout.config?.nodes === panel) {
              // don't hide the view if it's the only one
              return;
            }
            const result = removeMosaicNodeByKey(
              get().layout.config?.nodes,
              panel,
            );
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
      };
    },
  );
}

type LayoutCommandStoreState = BaseRoomStoreState & LayoutSliceState;

function createLayoutPanelCommands(
  panels: Record<string, RoomPanelInfo>,
): RoomCommand<LayoutCommandStoreState>[] {
  const byIdCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.panel.toggle',
    name: 'Toggle panel by ID',
    description: 'Show or hide a panel by its ID',
    group: 'Layout',
    keywords: ['layout', 'panel', 'toggle', 'show', 'hide', 'id'],
    inputSchema: ToggleLayoutPanelCommandInput,
    inputDescription:
      'Provide panelId and optional show. If show is omitted, the panel visibility is toggled.',
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
      const {panelId, show} = input as ToggleLayoutPanelCommandInput;
      getState().layout.togglePanel(panelId, show);
      return {
        success: true,
        commandId: 'layout.panel.toggle',
        message: `Toggled panel "${panelId}".`,
      };
    },
  };

  const pinByIdCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.panel.toggle-pin',
    name: 'Toggle panel pin by ID',
    description: 'Pin or unpin a panel by its ID',
    group: 'Layout',
    keywords: ['layout', 'panel', 'pin', 'unpin', 'id'],
    inputSchema: ToggleLayoutPanelPinInput,
    inputDescription: 'Provide panelId to toggle pin state.',
    metadata: {
      readOnly: false,
      idempotent: true,
      riskLevel: 'low',
    },
    validateInput: (input, {getState}) => {
      const {panelId} = input as ToggleLayoutPanelPinInput;
      if (!getState().layout.panels[panelId]) {
        throw new Error(`Unknown panel ID "${panelId}".`);
      }
    },
    execute: ({getState}, input) => {
      const {panelId} = input as ToggleLayoutPanelPinInput;
      getState().layout.togglePanelPin(panelId);
      return {
        success: true,
        commandId: 'layout.panel.toggle-pin',
        message: `Toggled pin state for panel "${panelId}".`,
      };
    },
  };

  const panelShortcutCommands: RoomCommand<LayoutCommandStoreState>[] =
    Object.entries(panels).map(([panelId, panelInfo]) => {
      const title = panelInfo.title ?? panelId;
      const keywords = [panelId, panelInfo.title, panelInfo.placement].filter(
        (value): value is string => Boolean(value),
      );
      return {
        id: `layout.panel.toggle.${panelId}`,
        name: `Toggle panel: ${title}`,
        description: `Show or hide the ${title} panel`,
        group: 'Layout',
        keywords,
        metadata: {
          readOnly: false,
          idempotent: true,
          riskLevel: 'low',
        },
        execute: ({getState}) => {
          getState().layout.togglePanel(panelId);
          return {
            success: true,
            commandId: `layout.panel.toggle.${panelId}`,
            message: `Toggled panel "${panelId}".`,
          };
        },
      };
    });

  return [byIdCommand, pinByIdCommand, ...panelShortcutCommands];
}

export function useStoreWithLayout<T>(
  selector: (state: LayoutSliceState) => T,
): T {
  return useBaseRoomStore<LayoutSliceState, T>((state) => selector(state));
}
