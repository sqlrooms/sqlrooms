import {
  Divider,
  Flex,
  IconButton,
  Spacer,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import {getVisibleMosaicLayoutPanels} from '@sqlrooms/layout';
import {useBaseProjectStore} from '@sqlrooms/project-builder';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import React, {FC, useMemo} from 'react';
type Props = {
  // nothing yet
};

export const SidebarButton: FC<{
  title: string;
  isSelected: boolean;
  isDisabled?: boolean;
  icon: React.ComponentType<any>;
  onClick: () => void;
}> = ({title, isSelected, isDisabled = false, icon: Icon, onClick}) => {
  return (
    <Tooltip label={title} placement="right" hasArrow>
      <IconButton
        icon={<Icon width="20px" />}
        size="sm"
        aria-label={title}
        bg={isSelected ? 'gray.600' : 'gray.700'}
        isDisabled={isDisabled}
        onClick={onClick}
      />
    </Tooltip>
  );
};

export const ProjectBuilderSidebarButton: FC<{type: ProjectPanelTypes}> = ({
  type,
}) => {
  const initialized = useBaseProjectStore((state) => state.initialized);
  const layout = useBaseProjectStore((state) => state.projectConfig.layout);
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);
  const visibleProjectPanels = useMemo(
    () => getVisibleMosaicLayoutPanels(layout?.nodes),
    [layout],
  );
  const togglePanel = useBaseProjectStore((state) => state.togglePanel);
  const {icon: Icon, title} = projectPanels[type as ProjectPanelTypes];

  return (
    <SidebarButton
      key={type}
      title={title}
      isSelected={visibleProjectPanels.includes(type)}
      isDisabled={!initialized}
      icon={Icon}
      onClick={() => togglePanel(type)}
    />
  );
};

const ProjectBuilderSidebarButtons: FC<Props> = () => {
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);
  // const initialized = useBaseProjectStore((state) => state.initialized);
  // if (!initialized) {
  //   return null;
  // }

  return (
    <Flex flexDir="column" flexGrow={1} h="100%">
      <VStack>
        {Object.keys(projectPanels)
          .filter((key) => projectPanels[key].placement === 'sidebar')
          .map((type) => {
            return (
              <ProjectBuilderSidebarButton
                key={type}
                type={type as ProjectPanelTypes}
              />
            );
          })}
      </VStack>
      <Spacer />
      <Divider />
      <VStack>
        {Object.keys(projectPanels)
          .filter((key) => projectPanels[key].placement === 'sidebar-bottom')
          .map((type) => {
            return (
              <ProjectBuilderSidebarButton
                key={type}
                type={type as ProjectPanelTypes}
              />
            );
          })}
      </VStack>
    </Flex>
  );
};

export default ProjectBuilderSidebarButtons;
