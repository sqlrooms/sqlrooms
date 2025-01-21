import {ProgressModal} from '@sqlrooms/components';
import {MosaicLayout, getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import React, {useCallback, useMemo} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {useBaseProjectStore} from './ProjectStateProvider';

const ProjectBuilder: React.FC = () => {
  const layout = useBaseProjectStore((state) => state.projectConfig.layout);
  const setLayout = useBaseProjectStore((state) => state.setLayout);
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);
  const loadingProgress = useBaseProjectStore((state) =>
    state.getLoadingProgress(),
  );
  const ErrorBoundary = useBaseProjectStore(
    (state) => state.CustomErrorBoundary,
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
      const PanelComp = projectPanels[id]?.component;
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
  }, [ErrorBoundary, projectPanels, visibleProjectPanels]);

  return (
    <>
      <div className="flex flex-col items-stretch px-0 pb-0 flex-grow w-full h-full">
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
    </>
  );
};

export default ProjectBuilder;
