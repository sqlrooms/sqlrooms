import {ProgressModal, SpinnerPane, useToast} from '@sqlrooms/ui';
import {MosaicLayout, getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import React, {Suspense, useCallback, useEffect, useMemo} from 'react';
import type {MosaicNode} from 'react-mosaic-component';
import {useBaseProjectBuilderStore} from './ProjectBuilderStore';

const ProjectBuilder: React.FC = () => {
  const initialized = useBaseProjectBuilderStore((state) => state.project.initialized);
  const layout = useBaseProjectBuilderStore((state) => state.config.layout);
  const setLayout = useBaseProjectBuilderStore(
    (state) => state.project.setLayout,
  );
  const panels = useBaseProjectBuilderStore((state) => state.project.panels);
  const loadingProgress = useBaseProjectBuilderStore((state) =>
    state.project.getLoadingProgress(),
  );
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

  const projectError = useBaseProjectBuilderStore((state) => state.project.projectError);
  const {toast} = useToast();
  useEffect(() => {
    if (projectError) {
      toast({
        title: 'Project initialization failed',
        variant: 'destructive',
        description: projectError.message,
        duration: Infinity,
      });
    }
  }, [projectError]);
  if (!initialized) {
    return <SpinnerPane h="100%" />;
  }
  return (
    <ErrorBoundary>
      <Suspense fallback={<SpinnerPane h="100%" />}>
        <div className="flex h-full w-full flex-grow flex-col items-stretch px-0 pb-0">
          {layout ? (
            <MosaicLayout
              renderTile={(id) => <>{renderedPanels.get(id)}</>}
              value={layout.nodes}
              onChange={handleLayoutChange}
            />
          ) : null}
        </div>

        <ProgressModal
          isOpen={loadingProgress !== undefined}
          title="Loading"
          loadingStage={loadingProgress?.message}
          progress={undefined}
          // progress={loadingProgress?.progress}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export {ProjectBuilder};
