import {Flex} from '@chakra-ui/react';
import {AppContext, ProgressModal} from '@sqlrooms/components';
import {MosaicLayout, getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import React, {useCallback, useContext, useMemo} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import {useBaseProjectStore} from './ProjectStateProvider';

type Props = {
  // nothing yet
};

const ProjectBuilder: React.FC<Props> = () => {
  // const projectConfig = useBaseProjectStore((state) => state.projectConfig);
  // console.log(projectConfig);
  const layout = useBaseProjectStore((state) => state.projectConfig.layout);
  const setLayout = useBaseProjectStore((state) => state.setLayout);
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);
  const loadingProgress = useBaseProjectStore((state) =>
    state.getLoadingProgress(),
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

  const {ErrorBoundary} = useContext(AppContext);
  const renderedPanels: Map<string, JSX.Element> = useMemo(() => {
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
    }, new Map<string, JSX.Element>());
  }, [ErrorBoundary, projectPanels, visibleProjectPanels]);

  return (
    <>
      <Flex
        alignItems="stretch"
        px={0}
        // pt="50px"
        pb={0}
        flexGrow={1}
        width="100%"
        height="100%"
      >
        {layout ? (
          <MosaicLayout
            renderTile={(id) => renderedPanels.get(id) ?? <></>}
            value={layout.nodes}
            onChange={handleLayoutChange}
          />
        ) : null}
      </Flex>

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
