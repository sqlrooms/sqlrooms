import {ProgressModal, SpinnerPane} from '@sqlrooms/ui';
import {MosaicLayout, getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import React, {Suspense, useCallback, useMemo} from 'react';
import type {MosaicNode} from 'react-mosaic-component';
import {useBaseRoomShellStore} from './RoomShellStore';

export const RoomShell: React.FC = () => {
  const layout = useBaseRoomShellStore((state) => state.layout.config);
  const setLayout = useBaseRoomShellStore((state) => state.layout.setLayout);
  const panels = useBaseRoomShellStore((state) => state.layout.panels);
  const loadingProgress = useBaseRoomShellStore((state) =>
    state.room.getLoadingProgress(),
  );
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
          indeterminate={true}
          // progress={loadingProgress?.progress}
        />
      </Suspense>
    </ErrorBoundary>
  );
};
