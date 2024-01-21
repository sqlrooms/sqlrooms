import {
  Divider,
  Flex,
  IconButton,
  Spacer,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import {getVisibleMosaicLayoutPanels} from '@flowmapcity/layout';
import {useProjectStore} from '@flowmapcity/project-builder';
import {ProjectPanelTypes} from '@flowmapcity/project-config';
import {SqlEditorModal} from '@flowmapcity/sql-editor';
import React, {FC, useMemo} from 'react';
import {TbDatabaseSearch} from 'react-icons/tb';
type Props = {
  // nothing yet
};

const SidebarButton: FC<{
  title: string;
  isSelected: boolean;
  icon: React.ComponentType<any>;
  onClick: () => void;
}> = ({title, isSelected, icon: Icon, onClick}) => {
  return (
    <Tooltip label={title} placement="right" hasArrow>
      <IconButton
        icon={<Icon width="20px" />}
        size="sm"
        aria-label={title}
        bg={isSelected ? 'gray.600' : 'gray.700'}
        onClick={onClick}
      />
    </Tooltip>
  );
};

export const ProjectBuilderSidebarButton: FC<{type: ProjectPanelTypes}> = ({
  type,
}) => {
  const layout = useProjectStore((state) => state.projectConfig.layout);
  const projectPanels = useProjectStore((state) => state.projectPanels);
  const visibleProjectPanels = useMemo(
    () => getVisibleMosaicLayoutPanels(layout?.nodes),
    [layout],
  );
  const togglePanel = useProjectStore((state) => state.togglePanel);
  const {icon: Icon, title} = projectPanels[type as ProjectPanelTypes];

  return (
    <SidebarButton
      key={type}
      title={title}
      isSelected={visibleProjectPanels.includes(type)}
      icon={Icon}
      onClick={() => togglePanel(type)}
    />
  );
};

const ProjectBuilderSidebarButtons: FC<Props> = () => {
  const initialized = useProjectStore((state) => state.initialized);
  const projectPanels = useProjectStore((state) => state.projectPanels);
  const sqlEditor = useDisclosure();
  if (!initialized) {
    return null;
  }

  return (
    <Flex flexDir="column" flexGrow={1} h="100%">
      <VStack>
        {Object.keys(projectPanels)
          .filter((key) => projectPanels[key].placement === 'sidebar')
          .map((type) => {
            // if (type === ProjectPanelTypes.MAIN_VIEW) {
            //   return null;
            // }
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
      <SidebarButton
        title="SQL Editor"
        onClick={sqlEditor.onToggle}
        isSelected={false}
        icon={() => <TbDatabaseSearch size="19px" />}
      />
      {sqlEditor.isOpen ? (
        <SqlEditorModal
          schema={'main'}
          isOpen={sqlEditor.isOpen}
          onClose={sqlEditor.onClose}
        />
      ) : null}
    </Flex>
  );
};

export default ProjectBuilderSidebarButtons;
