import {z} from 'zod';
import {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {findTabsNodeForPanel} from './mosaic/mosaic-utils';
import type {Panels, RoomPanelInfo} from './types';
import type {LayoutSliceState} from './LayoutSlice';

export const LAYOUT_COMMAND_OWNER = '@sqlrooms/layout/panels';

export const ToggleLayoutPanelCommandInput = z.object({
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
export type ToggleLayoutPanelCommandInput = z.infer<
  typeof ToggleLayoutPanelCommandInput
>;

export const AreaSetActivePanelInput = z.object({
  areaId: z.string().describe('ID of the area.'),
  panelId: z.string().describe('ID of the panel to make active.'),
});
export type AreaSetActivePanelInput = z.infer<typeof AreaSetActivePanelInput>;

export const AreaCollapseInput = z.object({
  areaId: z.string().describe('ID of the area to collapse/expand.'),
  collapsed: z.boolean().describe('True to collapse, false to expand.'),
});
export type AreaCollapseInput = z.infer<typeof AreaCollapseInput>;

export const AreaAddPanelInput = z.object({
  areaId: z.string().describe('ID of the area.'),
  panelId: z.string().describe('ID of the panel to add.'),
});
export type AreaAddPanelInput = z.infer<typeof AreaAddPanelInput>;

export const AreaRemovePanelInput = z.object({
  areaId: z.string().describe('ID of the area.'),
  panelId: z.string().describe('ID of the panel to remove.'),
});
export type AreaRemovePanelInput = z.infer<typeof AreaRemovePanelInput>;

export type LayoutCommandStoreState = BaseRoomStoreState & LayoutSliceState;

export function createLayoutPanelCommands(
  panels: Panels,
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
      const tabsId = findTabsNodeForPanel(getState().layout.config, panelId);
      if (tabsId) {
        getState().layout.setActiveTab(tabsId, panelId);
      }
      return {
        success: true,
        commandId: 'layout.panel.show',
        message: `Activated panel "${panelId}"${tabsId ? ` in "${tabsId}"` : ''}.`,
      };
    },
  };

  const panelShortcutCommands: RoomCommand<LayoutCommandStoreState>[] =
    Object.entries(panels)
      .filter(
        (entry): entry is [string, RoomPanelInfo] =>
          typeof entry[1] !== 'function',
      )
      .map(([panelId, panelInfo]) => {
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
            const tabsId = findTabsNodeForPanel(
              getState().layout.config,
              panelId,
            );
            if (tabsId) {
              getState().layout.setActiveTab(tabsId, panelId);
            }
            return {
              success: true,
              commandId: `layout.panel.show.${panelId}`,
              message: `Activated panel "${panelId}".`,
            };
          },
        };
      });

  const setActiveTabCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.tabs.set-active',
    name: 'Set active tab',
    description: 'Set which tab is visible in a tabs node',
    group: 'Layout',
    keywords: ['layout', 'tab', 'active', 'panel', 'select'],
    inputSchema: AreaSetActivePanelInput,
    inputDescription: 'Provide areaId and panelId.',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, panelId} = input as AreaSetActivePanelInput;
      getState().layout.setActiveTab(areaId, panelId);
      return {
        success: true,
        commandId: 'layout.tabs.set-active',
        message: `Set active tab in "${areaId}" to "${panelId}".`,
      };
    },
  };

  const collapseCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.tabs.collapse',
    name: 'Collapse or expand',
    description: 'Collapse or expand a collapsible layout node',
    group: 'Layout',
    keywords: ['layout', 'collapse', 'expand', 'toggle'],
    inputSchema: AreaCollapseInput,
    inputDescription: 'Provide areaId and collapsed (true/false).',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, collapsed} = input as AreaCollapseInput;
      getState().layout.setCollapsed(areaId, collapsed);
      return {
        success: true,
        commandId: 'layout.tabs.collapse',
        message: `${collapsed ? 'Collapsed' : 'Expanded'} "${areaId}".`,
      };
    },
  };

  const addTabCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.tabs.add',
    name: 'Add tab',
    description: 'Add a tab to a tabs node',
    group: 'Layout',
    keywords: ['layout', 'add', 'panel', 'tab'],
    inputSchema: AreaAddPanelInput,
    inputDescription: 'Provide areaId and panelId.',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, panelId} = input as AreaAddPanelInput;
      getState().layout.addTab(areaId, panelId);
      return {
        success: true,
        commandId: 'layout.tabs.add',
        message: `Added tab "${panelId}" to "${areaId}".`,
      };
    },
  };

  const removeTabCommand: RoomCommand<LayoutCommandStoreState> = {
    id: 'layout.tabs.remove',
    name: 'Remove tab',
    description: 'Remove a tab from a tabs node',
    group: 'Layout',
    keywords: ['layout', 'remove', 'panel', 'tab', 'close'],
    inputSchema: AreaRemovePanelInput,
    inputDescription: 'Provide areaId and panelId.',
    metadata: {readOnly: false, idempotent: true, riskLevel: 'low'},
    execute: ({getState}, input) => {
      const {areaId, panelId} = input as AreaRemovePanelInput;
      getState().layout.removeTab(areaId, panelId);
      return {
        success: true,
        commandId: 'layout.tabs.remove',
        message: `Removed tab "${panelId}" from "${areaId}".`,
      };
    },
  };

  return [
    byIdCommand,
    ...panelShortcutCommands,
    setActiveTabCommand,
    collapseCommand,
    addTabCommand,
    removeTabCommand,
  ];
}
