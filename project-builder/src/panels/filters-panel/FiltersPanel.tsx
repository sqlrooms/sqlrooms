import React, {FC} from 'react';
import {Flex} from '@chakra-ui/react';
import {ProjectPanelTypes} from '@flowmapcity/project-config';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';
import {
  FlowmapViewStateProvider,
  FlowmapFiltersPanel,
} from '@flowmapcity/flowmap';

type Props = {
  // nothing yet
};
const FiltersPanel: FC<Props> = () => {
  return (
    <Flex
      flexDir="column"
      overflowX="hidden"
      overflowY="auto"
      height="100%"
      gap={5}
    >
      <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.FILTERS} />
      <FlowmapViewStateProvider viewId="flowmap">
        <FlowmapFiltersPanel />
      </FlowmapViewStateProvider>
    </Flex>
  );
};

export default FiltersPanel;
FiltersPanel;
