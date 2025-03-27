import {ProgressModal, SpinnerPane} from '@sqlrooms/ui';
import {MosaicLayout, getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import React, {Suspense, useCallback, useMemo} from 'react';
import type {MosaicNode} from 'react-mosaic-component';
import {useBaseProjectBuilderStore} from './ProjectBuilderStore';

const ProjectBuilder: React.FC = () => {
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
          progress={loadingProgress?.progress}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export {ProjectBuilder};
