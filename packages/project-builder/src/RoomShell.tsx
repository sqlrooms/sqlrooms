import {getVisibleMosaicLayoutPanels, MosaicLayout} from '@sqlrooms/layout';
import {ProjectStateProvider} from '@sqlrooms/project';
import {BaseProjectConfig} from '@sqlrooms/project-config';
import {ProjectStore} from '@sqlrooms/project/dist/ProjectStore';
import {cn, ErrorBoundary, ProgressModal, SpinnerPane} from '@sqlrooms/ui';
import {FC, PropsWithChildren, Suspense, useCallback, useMemo} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {useBaseProjectBuilderStore} from './ProjectBuilderStore';
import {ProjectBuilderSidebarButtons} from './ProjectBuilderSidebarButtons';

export function RoomShellBase<PC extends BaseProjectConfig>({
  className,
  children,
  roomStore,
}: React.PropsWithChildren<{
  className?: string;
  roomStore?: ProjectStore<PC>;
}>) {
  return (
    <ProjectStateProvider projectStore={roomStore}>
      <div className={cn('flex h-full w-full', className)}>
        <ErrorBoundary>
          <Suspense fallback={<SpinnerPane h="100%" />}>{children}</Suspense>
        </ErrorBoundary>
      </div>
    </ProjectStateProvider>
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
      <ProjectBuilderSidebarButtons className={className} />
      {children}
    </div>
  );
};

export const LayoutComposer: FC<{className?: string}> = ({className}) => {
  const layout = useBaseProjectBuilderStore((state) => state.config.layout);
  const setLayout = useBaseProjectBuilderStore(
    (state) => state.project.setLayout,
  );
  const panels = useBaseProjectBuilderStore((state) => state.project.panels);
  const ErrorBoundary = useBaseProjectBuilderStore(
    (state) => state.project.CustomErrorBoundary,
  );

  const visibleProjectPanels = useMemo(
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
    return Array.from(visibleProjectPanels).reduce((acc, id: string) => {
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
  }, [ErrorBoundary, panels, visibleProjectPanels]);

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
  const loadingProgress = useBaseProjectBuilderStore((state) =>
    state.project.getLoadingProgress(),
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
