import {getVisibleMosaicLayoutPanels, MosaicLayout} from '@sqlrooms/layout';
import {RoomStateProvider} from '@sqlrooms/core';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {RoomStore} from '@sqlrooms/core';
import {cn, ErrorBoundary, ProgressModal, SpinnerPane} from '@sqlrooms/ui';
import {FC, PropsWithChildren, Suspense, useCallback, useMemo} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {useBaseRoomShellStore} from './RoomShellStore';
import {RoomShellSidebarButtons} from './RoomShellSidebarButtons';

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
          <Suspense fallback={<SpinnerPane h="100%" />}>{children}</Suspense>
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
        'bg-muted/50 flex h-full w-16 flex-col px-1 py-2',
        className,
      )}
    >
      <RoomShellSidebarButtons className={className} />
      {children}
    </div>
  );
};

export const LayoutComposer: FC<{className?: string}> = ({className}) => {
  const layout = useBaseRoomShellStore((state) => state.config.layout);
  const setLayout = useBaseRoomShellStore((state) => state.room.setLayout);
  const panels = useBaseRoomShellStore((state) => state.room.panels);
  const ErrorBoundary = useBaseRoomShellStore(
    (state) => state.room.CustomErrorBoundary,
  );

  const visibleRoomPanels = useMemo(
    () => getVisibleMosaicLayoutPanels(layout?.nodes),
    [layout],
  );

  const handleLayoutChange = useCallback(
    (nodes: MosaicNode<string> | null) => {
      // Keep layout properties, e.g. 'pinned' and 'fixed'
      setLayout({...layout, nodes});
    },
    [setLayout, layout],
  );
  const renderedPanels: Map<string, React.ReactNode> = useMemo(() => {
    return Array.from(visibleRoomPanels).reduce((acc, id: string) => {
      const PanelComp = panels[id]?.component;
      if (PanelComp) {
        acc.set(
          id,
          <ErrorBoundary>
            <PanelComp />
          </ErrorBoundary>,
        );
      }
      return acc;
    }, new Map<string, React.ReactNode>());
  }, [ErrorBoundary, panels, visibleRoomPanels]);

  return (
    <div
      className={cn(
        'flex h-full w-full flex-grow flex-col items-stretch',
        className,
      )}
    >
      {layout ? (
        <MosaicLayout
          renderTile={(id) => <>{renderedPanels.get(id)}</>}
          value={layout.nodes}
          onChange={handleLayoutChange}
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
  LayoutComposer: LayoutComposer,
  LoadingProgress: LoadingProgress,
});
