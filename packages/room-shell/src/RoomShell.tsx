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
  TabButtons,
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
  onTabCreate?: (tabsId: string) => void;
}> = ({className, onTabCreate}) => {
  const rootLayout = useBaseRoomShellStore((state) => state.layout.config);
  const setLayout = useBaseRoomShellStore((state) => state.layout.setConfig);
  const panels = useBaseRoomShellStore((state) => state.layout.panels);

  const setActiveTab = useBaseRoomShellStore(
    (state) => state.layout.setActiveTab,
  );
  const removeTab = useBaseRoomShellStore((state) => state.layout.removeTab);
  const setCollapsed = useBaseRoomShellStore(
    (state) => state.layout.setCollapsed,
  );

  const handleLayoutChange = useCallback(
    (newLayout: LayoutNode | null) => {
      setLayout(newLayout);
    },
    [setLayout],
  );

  const handleTabSelect = useCallback(
    (tabsId: string, tabId: string) => {
      setActiveTab(tabsId, tabId);
    },
    [setActiveTab],
  );

  const handleTabClose = useCallback(
    (tabsId: string, tabId: string) => {
      removeTab(tabsId, tabId);
    },
    [removeTab],
  );

  const handleTabReorder = useCallback(
    (tabsId: string, tabIds: string[]) => {
      const activeTab = tabIds[0];
      if (activeTab) {
        setActiveTab(tabsId, activeTab);
      }
    },
    [setActiveTab],
  );

  const handleCollapse = useCallback(
    (id: string) => {
      setCollapsed(id, true);
    },
    [setCollapsed],
  );

  const handleExpand = useCallback(
    (id: string, tabId?: string) => {
      setCollapsed(id, false);
      if (tabId) {
        setActiveTab(id, tabId);
      }
    },
    [setCollapsed, setActiveTab],
  );

  return (
    <div
      className={cn(
        'flex h-full min-w-0 grow flex-col items-stretch',
        className,
      )}
    >
      {rootLayout ? (
        <LayoutRenderer
          rootLayout={rootLayout}
          onLayoutChange={handleLayoutChange}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          onTabCreate={onTabCreate}
          onCollapse={handleCollapse}
          onExpand={handleExpand}
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
  TabButtons: TabButtons,
  /** @deprecated Use TabButtons instead */
  AreaPanelButtons: AreaPanelButtons,
  LayoutComposer: LayoutComposer,
  LoadingProgress: LoadingProgress,
  CommandPalette: RoomShellCommandPalette,
});
