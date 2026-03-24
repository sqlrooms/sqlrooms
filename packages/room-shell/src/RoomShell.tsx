import {getNodeAtPath, MosaicLayout} from '@sqlrooms/layout';
import type {MosaicLayoutNode} from '@sqlrooms/layout-config';
import {
  isMosaicLayoutTabsNode,
  MosaicLayoutTabsNode,
} from '@sqlrooms/layout-config';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {
  cn,
  ErrorBoundary,
  ProgressModal,
  SpinnerPane,
  Toaster,
  TooltipProvider,
} from '@sqlrooms/ui';
import {FC, PropsWithChildren, Suspense, useCallback} from 'react';
import {MosaicPath} from 'react-mosaic-component';
import {RoomShellCommandPalette} from './RoomShellCommandPalette';
import {
  AreaPanelButtons,
  RoomShellSidebarButtons,
  SidebarButton,
} from './RoomShellSidebarButtons';
import {RoomShellStore, useBaseRoomShellStore} from './RoomShellSlice';

function findAreaByPath(
  root: MosaicLayoutNode,
  path: MosaicPath,
): MosaicLayoutTabsNode | undefined {
  const node = getNodeAtPath(root, path);
  if (node && isMosaicLayoutTabsNode(node as MosaicLayoutTabsNode)) {
    return node as MosaicLayoutTabsNode;
  }
  return undefined;
}

function updateTabsOrder(
  root: MosaicLayoutNode | null,
  path: MosaicPath,
  newTabIds: string[],
): MosaicLayoutNode | null {
  if (!root) return root;
  if (path.length === 0) {
    if (typeof root === 'object' && 'type' in root && root.type === 'tabs') {
      const tabsNode = root as MosaicLayoutTabsNode;
      const activeTab = tabsNode.tabs[tabsNode.activeTabIndex];
      const newActiveIndex = activeTab ? newTabIds.indexOf(activeTab) : 0;
      return {
        ...tabsNode,
        tabs: newTabIds,
        activeTabIndex: Math.max(0, newActiveIndex),
      };
    }
    return root;
  }
  if (typeof root === 'string') return root;
  const [head, ...rest] = path;
  if (head === undefined) return root;
  if ('children' in root && Array.isArray(root.children)) {
    const newChildren = [...root.children];
    newChildren[head] = updateTabsOrder(
      newChildren[head] as MosaicLayoutNode,
      rest,
      newTabIds,
    ) as MosaicLayoutNode;
    return {...root, children: newChildren};
  }
  return root;
}

export function RoomShellBase({
  className,
  children,
  roomStore,
}: React.PropsWithChildren<{
  className?: string;
  roomStore?: RoomShellStore;
}>) {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <div className={cn('flex h-full w-full', className)}>
        <ErrorBoundary>
          <Suspense fallback={<SpinnerPane h="100%" />}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </Suspense>
        </ErrorBoundary>
      </div>
    </RoomStateProvider>
  );
}

export const SidebarContainer: FC<PropsWithChildren<{className?: string}>> = ({
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'bg-muted/70 flex h-full w-12 flex-col items-center gap-2 px-1 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
};

/**
 * @deprecated Use SidebarContainer instead
 */
export const RoomSidebar: FC<PropsWithChildren<{className?: string}>> = ({
  className,
  children,
}) => {
  return (
    <SidebarContainer className={className}>
      <RoomShellSidebarButtons /> {children}
    </SidebarContainer>
  );
};

export const LayoutComposer: FC<{
  className?: string;
  tileClassName?: string;
}> = ({className, tileClassName}) => {
  const layout = useBaseRoomShellStore((state) => state.layout.config);
  const setLayout = useBaseRoomShellStore((state) => state.layout.setLayout);
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const setActivePanel = useBaseRoomShellStore(
    (state) => state.layout.setActivePanel,
  );
  const removePanelFromArea = useBaseRoomShellStore(
    (state) => state.layout.removePanelFromArea,
  );
  const setAreaCollapsed = useBaseRoomShellStore(
    (state) => state.layout.setAreaCollapsed,
  );
  const ErrorBoundary = useBaseRoomShellStore(
    (state) => state.room.CustomErrorBoundary,
  );

  const handleLayoutChange = useCallback(
    (nodes: MosaicLayoutNode | null) => {
      setLayout({...layout, nodes});
    },
    [setLayout, layout],
  );

  const handleTabSelect = useCallback(
    (path: MosaicPath, tabId: string) => {
      const areaResult = layout.nodes
        ? findAreaByPath(layout.nodes, path)
        : undefined;
      if (areaResult?.id) {
        setActivePanel(areaResult.id, tabId);
      }
    },
    [layout.nodes, setActivePanel],
  );

  const handleTabClose = useCallback(
    (path: MosaicPath, tabId: string) => {
      const areaResult = layout.nodes
        ? findAreaByPath(layout.nodes, path)
        : undefined;
      if (areaResult?.id) {
        removePanelFromArea(areaResult.id, tabId);
      }
    },
    [layout.nodes, removePanelFromArea],
  );

  const handleTabReorder = useCallback(
    (path: MosaicPath, tabIds: string[]) => {
      const areaResult = layout.nodes
        ? findAreaByPath(layout.nodes, path)
        : undefined;
      if (areaResult?.id) {
        setLayout({
          ...layout,
          nodes: updateTabsOrder(layout.nodes, path, tabIds),
        });
      }
    },
    [layout, setLayout],
  );

  const handleAreaCollapse = useCallback(
    (areaId: string) => {
      setAreaCollapsed(areaId, true);
    },
    [setAreaCollapsed],
  );

  const handleAreaExpand = useCallback(
    (areaId: string, panelId?: string) => {
      setAreaCollapsed(areaId, false);
      if (panelId) {
        setActivePanel(areaId, panelId);
      }
    },
    [setAreaCollapsed, setActivePanel],
  );

  const renderTile = (panelId: string) => {
    const PanelComp = panelId && panels[panelId]?.component;
    if (!PanelComp) {
      return <></>;
    }
    return (
      <ErrorBoundary key={panelId}>
        <PanelComp />
      </ErrorBoundary>
    );
  };

  return (
    <div
      className={cn(
        'flex h-full w-full grow flex-col items-stretch',
        className,
      )}
    >
      {layout ? (
        <MosaicLayout
          renderTile={renderTile}
          value={layout.nodes}
          onChange={handleLayoutChange}
          tileClassName={tileClassName}
          panels={panels}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onAreaCollapse={handleAreaCollapse}
          onAreaExpand={handleAreaExpand}
        />
      ) : null}
    </div>
  );
};

export const LoadingProgress: FC<{className?: string}> = ({className}) => {
  const loadingProgress = useBaseRoomShellStore((state) =>
    state.room.getLoadingProgress(),
  );
  return (
    <ProgressModal
      className={className}
      isOpen={loadingProgress !== undefined}
      title="Loading"
      loadingStage={loadingProgress?.message}
      indeterminate={true}
      // progress={loadingProgress?.progress}
    />
  );
};

export const RoomShell = Object.assign(RoomShellBase, {
  /**
   * @deprecated Use SidebarContainer instead
   */
  Sidebar: RoomSidebar,
  SidebarContainer: SidebarContainer,
  SidebarButton: SidebarButton,
  SidebarButtons: RoomShellSidebarButtons,
  AreaPanelButtons: AreaPanelButtons,
  LayoutComposer: LayoutComposer,
  LoadingProgress: LoadingProgress,
  CommandPalette: RoomShellCommandPalette,
});
