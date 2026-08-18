import {
  LayoutRenderer,
  RoomDndProvider,
  useStoreWithLayout,
} from '@sqlrooms/layout';
import type {LayoutNode} from '@sqlrooms/layout-config';
import {
  RoomStateProvider,
  useBaseRoomStore,
  type BaseRoomStoreState,
  type StoreApi,
} from '@sqlrooms/room-store';
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

/** Minimal room state required by the Room Shell container. */
export type RoomShellBaseState = BaseRoomStoreState & {
  room: BaseRoomStoreState['room'] & {
    CustomErrorBoundary?: React.ComponentType<{
      onRetry?: () => void;
      children?: React.ReactNode;
    }>;
  };
};

type RoomShellLoadingProgress = {
  message: string;
  error?: string;
  errorDetails?: string;
};

type RoomShellLoadingState = {
  room: {
    getLoadingProgress: () => RoomShellLoadingProgress | undefined;
  };
};

export function RoomShellBase<RS extends RoomShellBaseState>({
  className,
  children,
  roomStore,
}: React.PropsWithChildren<{
  className?: string;
  roomStore?: StoreApi<RS>;
}>) {
  const CustomErrorBoundary =
    roomStore?.getState().room.CustomErrorBoundary ?? ErrorBoundary;
  return (
    <RoomStateProvider roomStore={roomStore}>
      <div className={cn('flex h-full w-full', className)}>
        <CustomErrorBoundary>
          <Suspense fallback={<SpinnerPane h="100%" />}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </Suspense>
        </CustomErrorBoundary>
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
  const rootLayout = useStoreWithLayout((state) => state.layout.config);
  const setLayout = useStoreWithLayout((state) => state.layout.setConfig);

  const setActiveTab = useStoreWithLayout((state) => state.layout.setActiveTab);
  const removeTab = useStoreWithLayout((state) => state.layout.removeTab);
  const reorderTabs = useStoreWithLayout((state) => state.layout.reorderTabs);
  const setCollapsed = useStoreWithLayout((state) => state.layout.setCollapsed);

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
      reorderTabs(tabsId, tabIds);
    },
    [reorderTabs],
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
  const loadingProgress = useBaseRoomStore<
    RoomShellLoadingState,
    RoomShellLoadingProgress | undefined
  >((state) => state.room.getLoadingProgress());
  return (
    <ProgressModal
      className={className}
      isOpen={loadingProgress !== undefined}
      title={loadingProgress?.error ? 'Unable to start SQLRooms' : 'Loading'}
      loadingStage={loadingProgress?.message}
      error={loadingProgress?.error}
      errorDetails={loadingProgress?.errorDetails}
      indeterminate={true}
    />
  );
};

export const RoomShell = Object.assign(RoomShellBase, {
  DndProvider: RoomDndProvider,
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
