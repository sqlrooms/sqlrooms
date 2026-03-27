import {LayoutRenderer} from '@sqlrooms/layout';
import type {LayoutNode} from '@sqlrooms/layout-config';
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
import {RoomShellCommandPalette} from './RoomShellCommandPalette';
import {
  AreaPanelButtons,
  RoomShellSidebarButtons,
  SidebarButton,
} from './RoomShellSidebarButtons';
import {RoomShellStore, useBaseRoomShellStore} from './RoomShellSlice';

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
  onTabCreate?: (areaId: string) => void;
}> = ({className, onTabCreate}) => {
  const layout = useBaseRoomShellStore((state) => state.layout.config);
  const setLayout = useBaseRoomShellStore((state) => state.layout.setConfig);
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const renderPanel = useBaseRoomShellStore(
    (state) => state.layout.renderPanel,
  );
  const renderTabStrip = useBaseRoomShellStore(
    (state) => state.layout.renderTabStrip,
  );
  const setActivePanel = useBaseRoomShellStore(
    (state) => state.layout.setActivePanel,
  );
  const removePanelFromArea = useBaseRoomShellStore(
    (state) => state.layout.removePanelFromArea,
  );
  const setAreaCollapsed = useBaseRoomShellStore(
    (state) => state.layout.setAreaCollapsed,
  );

  const handleLayoutChange = useCallback(
    (newLayout: LayoutNode | null) => {
      setLayout(newLayout);
    },
    [setLayout],
  );

  const handleTabSelect = useCallback(
    (areaId: string, tabId: string) => {
      setActivePanel(areaId, tabId);
    },
    [setActivePanel],
  );

  const handleTabClose = useCallback(
    (areaId: string, tabId: string) => {
      removePanelFromArea(areaId, tabId);
    },
    [removePanelFromArea],
  );

  const handleTabReorder = useCallback(
    (areaId: string, tabIds: string[]) => {
      // Tab reorder is handled via setConfig with updated children order
      // For now, just set the active tab to preserve selection
      const activeTab = tabIds[0];
      if (activeTab) {
        setActivePanel(areaId, activeTab);
      }
    },
    [setActivePanel],
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

  return (
    <div
      className={cn(
        'flex h-full w-full grow flex-col items-stretch',
        className,
      )}
    >
      {layout ? (
        <LayoutRenderer
          layout={layout}
          panels={panels}
          renderPanel={renderPanel}
          renderTabStrip={renderTabStrip}
          onLayoutChange={handleLayoutChange}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onTabCreate={onTabCreate}
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
