import {Flex} from '@chakra-ui/react';
import {
  FlowmapFiltersPanel,
  FlowmapViewStateProvider,
} from '@flowmapcity/flowmap';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import {FC} from 'react';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';

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
