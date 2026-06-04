import {LayoutRenderer, type LayoutNode, type Panels} from '@sqlrooms/layout';
import {RoomStateProvider, type StoreApi} from '@sqlrooms/room-store';
import {
  Button,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {FileSpreadsheet, Sparkles} from 'lucide-react';
import {useCallback, useEffect, useMemo, useSyncExternalStore} from 'react';
import type {JsonObject} from '#/lib/json';
import {AssistantPanel} from '../assistant/AssistantPanel';
import {WorksheetSurface} from '../WorksheetSurface';
import type {useWorkspaceDuckDbRuntime} from '../worksheet/useWorkspaceDuckDbRuntime';
import {
  ASSISTANT_PANEL_ID,
  createDefaultWorkspaceLayout,
  type WorkspaceRoomState,
} from './WorkspaceRoomStore';
import {
  WorkspaceRoomProvider,
  type SaveWorkspaceRoomSnapshot,
} from './WorkspaceRoomProvider';

const DEFAULT_WORKSPACE_LAYOUT = createDefaultWorkspaceLayout();

export type WorkspaceLayoutWorksheet = {
  id: string;
  title: string;
  content: JsonObject;
};

export function WorkspaceLayoutSurface({
  workspaceKey,
  layout,
  aiConfig,
  workspaceContent,
  selectedWorksheet,
  token,
  duckDbRuntime,
  onRoomStoreChange,
  saveRoomSnapshot,
}: {
  workspaceKey: string;
  layout: LayoutNode;
  aiConfig: JsonObject;
  workspaceContent: JsonObject | undefined;
  selectedWorksheet: WorkspaceLayoutWorksheet | undefined;
  token: string | null;
  duckDbRuntime: ReturnType<typeof useWorkspaceDuckDbRuntime>;
  onRoomStoreChange: (roomStore: StoreApi<WorkspaceRoomState> | null) => void;
  saveRoomSnapshot: SaveWorkspaceRoomSnapshot | null;
}) {
  const panels = useMemo<Panels>(
    () => ({
      assistant: {
        title: 'Assistant',
        icon: Sparkles,
        component: function WorkspaceAssistantPanel() {
          return (
            <AssistantPanel
              worksheetId={selectedWorksheet?.id}
              worksheetTitle={selectedWorksheet?.title}
            />
          );
        },
      },
      worksheet: {
        title: selectedWorksheet?.title ?? 'Worksheet',
        icon: FileSpreadsheet,
        component: function WorkspaceWorksheetPanel() {
          return (
            <section className="worksheet-panel">
              <ScrollArea className="worksheet-stage">
                {selectedWorksheet ? (
                  <WorksheetSurface
                    worksheet={selectedWorksheet}
                    tableNames={duckDbRuntime.tableNames}
                  />
                ) : null}
              </ScrollArea>
            </section>
          );
        },
      },
    }),
    [duckDbRuntime.tableNames, selectedWorksheet],
  );

  return (
    <WorkspaceRoomProvider
      workspaceKey={workspaceKey}
      layout={layout}
      aiConfig={aiConfig}
      content={workspaceContent}
      panels={panels}
      token={token}
      duckDbRuntime={duckDbRuntime}
      onRoomStoreChange={onRoomStoreChange}
      saveRoomSnapshot={saveRoomSnapshot}
    >
      {(roomStore) => (
        <WorkspaceLayoutSurfaceContent
          roomStore={roomStore}
          panels={panels}
          selectedWorksheetId={selectedWorksheet?.id}
          duckDbRuntime={duckDbRuntime}
        />
      )}
    </WorkspaceRoomProvider>
  );
}

function WorkspaceLayoutSurfaceContent({
  roomStore,
  panels,
  selectedWorksheetId,
  duckDbRuntime,
}: {
  roomStore: StoreApi<WorkspaceRoomState> | null;
  panels: Panels;
  selectedWorksheetId: string | undefined;
  duckDbRuntime: ReturnType<typeof useWorkspaceDuckDbRuntime>;
}) {
  useEffect(() => {
    if (!roomStore) return;
    roomStore.getState().workspace.setCurrentWorksheet(selectedWorksheetId);
  }, [roomStore, selectedWorksheetId]);

  useEffect(() => {
    if (!roomStore) return;
    if (arePanelsEqual(roomStore.getState().layout.panels, panels)) return;

    for (const [panelId, panel] of Object.entries(panels)) {
      roomStore.getState().layout.registerPanel(panelId, panel);
    }
  }, [panels, roomStore]);

  if (!roomStore) {
    return (
      <div className="workspace-panels">
        <div className="worksheet-block-placeholder">
          {duckDbRuntime.status === 'error'
            ? (duckDbRuntime.error ??
              'Could not prepare the workspace runtime.')
            : 'Preparing workspace'}
        </div>
      </div>
    );
  }

  return (
    <RoomStateProvider roomStore={roomStore}>
      <div className="workspace-panels">
        <WorkspaceRoomLayoutRenderer roomStore={roomStore} />
      </div>
    </RoomStateProvider>
  );
}

function WorkspaceRoomLayoutRenderer({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState>;
}) {
  const layout = useWorkspaceRoomLayout(roomStore);
  const setLayout = useCallback(
    (nextLayout: LayoutNode | null) => {
      roomStore
        .getState()
        .layout.setConfig(nextLayout ?? createDefaultWorkspaceLayout());
    },
    [roomStore],
  );
  const handleCollapse = useCallback(
    (panelId: string) => {
      setLayout(setLayoutNodeCollapsed(layout, panelId, true));
    },
    [layout, setLayout],
  );
  const handleExpand = useCallback(
    (panelId: string) => {
      setLayout(setLayoutNodeCollapsed(layout, panelId, false));
    },
    [layout, setLayout],
  );

  return (
    <LayoutRenderer
      className="workspace-layout-renderer"
      rootLayout={layout}
      onLayoutChange={setLayout}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
    />
  );
}

export function WorkspaceAssistantPanelToggle({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState> | null;
}) {
  if (!roomStore) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="topbar-icon"
            type="button"
            disabled
          >
            <Sparkles className="size-4" aria-hidden />
            <span className="sr-only">Show assistant</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show assistant</TooltipContent>
      </Tooltip>
    );
  }

  return <AssistantPanelToggleReady roomStore={roomStore} />;
}

function AssistantPanelToggleReady({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState>;
}) {
  const layout = useWorkspaceRoomLayout(roomStore);
  const isAssistantPanelCollapsed = useMemo(
    () => isLayoutNodeCollapsed(layout, ASSISTANT_PANEL_ID),
    [layout],
  );
  const handleToggleAssistantPanel = useCallback(() => {
    roomStore
      .getState()
      .layout.setConfig(
        setLayoutNodeCollapsed(
          layout,
          ASSISTANT_PANEL_ID,
          !isAssistantPanelCollapsed,
        ),
      );
  }, [isAssistantPanelCollapsed, layout, roomStore]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="topbar-icon"
          type="button"
          aria-pressed={!isAssistantPanelCollapsed}
          onClick={handleToggleAssistantPanel}
        >
          <Sparkles className="size-4" aria-hidden />
          <span className="sr-only">
            {isAssistantPanelCollapsed ? 'Show assistant' : 'Hide assistant'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isAssistantPanelCollapsed ? 'Show assistant' : 'Hide assistant'}
      </TooltipContent>
    </Tooltip>
  );
}

function useWorkspaceRoomLayout(roomStore: StoreApi<WorkspaceRoomState>) {
  return useSyncExternalStore(
    roomStore.subscribe,
    () => roomStore.getState().layout.config ?? DEFAULT_WORKSPACE_LAYOUT,
    () => DEFAULT_WORKSPACE_LAYOUT,
  );
}

function arePanelsEqual(left: Panels, right: Panels) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(
    ([panelId, panel]) =>
      Object.prototype.hasOwnProperty.call(right, panelId) &&
      right[panelId] === panel,
  );
}

function isLayoutNodeCollapsed(node: LayoutNode, nodeId: string): boolean {
  if (typeof node === 'string') return false;
  if (node.id === nodeId) return node.collapsed === true;

  if ('children' in node) {
    return node.children.some((child) => isLayoutNodeCollapsed(child, nodeId));
  }

  if ('root' in node) {
    return isLayoutNodeCollapsed(node.root, nodeId);
  }

  return false;
}

function setLayoutNodeCollapsed(
  node: LayoutNode,
  nodeId: string,
  collapsed: boolean,
): LayoutNode {
  if (typeof node === 'string') return node;

  if (node.id === nodeId) {
    return {...node, collapsed};
  }

  if ('children' in node) {
    return {
      ...node,
      children: node.children.map((child) =>
        setLayoutNodeCollapsed(child, nodeId, collapsed),
      ),
    };
  }

  if ('root' in node) {
    return {
      ...node,
      root: setLayoutNodeCollapsed(node.root, nodeId, collapsed),
    };
  }

  return node;
}
