import {RoomStateProvider, RoomStore} from '@sqlrooms/room-store';
import {MosaicLayout} from '@sqlrooms/layout';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {
  cn,
  ErrorBoundary,
  ProgressModal,
  SpinnerPane,
  Toaster,
  TooltipProvider,
} from '@sqlrooms/ui';
import {FC, PropsWithChildren, Suspense, useCallback} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {
  RoomShellSidebarButtons,
  SidebarButton,
} from './RoomShellSidebarButtons';
import {useBaseRoomShellStore} from './RoomShellStore';

export function RoomShellBase<PC extends BaseRoomConfig>({
  className,
  children,
  roomStore,
}: React.PropsWithChildren<{
  className?: string;
  roomStore?: RoomStore<PC>;
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

export const RoomSidebar: FC<PropsWithChildren<{className?: string}>> = ({
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'bg-muted/70 flex h-full w-12 flex-col items-center px-1 py-4',
        className,
      )}
    >
      <RoomShellSidebarButtons />
      {children}
    </div>
  );
};

export const LayoutComposer: FC<{
  className?: string;
  tileClassName?: string;
}> = ({className, tileClassName}) => {
  const layout = useBaseRoomShellStore((state) => state.layout.config);
  const setLayout = useBaseRoomShellStore((state) => state.layout.setLayout);
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const ErrorBoundary = useBaseRoomShellStore(
    (state) => state.room.CustomErrorBoundary,
  );

  const handleLayoutChange = useCallback(
    (nodes: MosaicNode<string> | null) => {
      // Keep layout properties, e.g. 'pinned' and 'fixed'
      setLayout({...layout, nodes});
    },
    [setLayout, layout],
  );

  // const visibleRoomPanels = useMemo(
  //   () => getVisibleMosaicLayoutPanels(layout?.nodes),
  //   [layout],
  // );

  const renderTile = (panelId: string) => {
    // const panelId = visibleRoomPanels.find((p) => p === id);
    const PanelComp = panelId && panels[panelId]?.component;
    if (!PanelComp) {
      return null;
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
        'flex h-full w-full flex-grow flex-col items-stretch',
        className,
      )}
    >
      {layout ? (
        <MosaicLayout
          renderTile={renderTile}
          value={layout.nodes}
          onChange={handleLayoutChange}
          tileClassName={tileClassName}
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
  Sidebar: RoomSidebar,
  SidebarButton: SidebarButton,
  LayoutComposer: LayoutComposer,
  LoadingProgress: LoadingProgress,
});
