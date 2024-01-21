import {Box, Flex, Heading} from '@chakra-ui/react';
import React, {FC, useMemo} from 'react';
import {useProjectStore} from '@flowmapcity/project-builder';
import {ProjectPanelTypes} from '@flowmapcity/project-config';
import {PanelHeaderButton} from '@flowmapcity/components';
import {XMarkIcon} from '@heroicons/react/24/solid';
import {BsFillPinAngleFill, BsFillPinFill} from 'react-icons/bs';

type Props = {
  panelKey: ProjectPanelTypes;
};
const ProjectBuilderPanelHeader: FC<Props> = (props) => {
  const {panelKey: type} = props;
  const projectPanels = useProjectStore((state) => state.projectPanels);
  const {icon: Icon, title} = projectPanels[type];
  const togglePanel = useProjectStore((state) => state.togglePanel);
  const togglePanelPin = useProjectStore((state) => state.togglePanelPin);
  const pinnedPanels = useProjectStore(
    (state) => state.projectConfig.layout.pinned,
  );
  const isPinned = useMemo(
    () => pinnedPanels?.includes(type),
    [pinnedPanels, type],
  );
  return (
    <>
      <Flex flexDir="row" width="100%" alignItems="center" gap={2}>
        <Icon width="20px" />
        <Heading
          as="h2"
          fontSize={'xs'}
          textTransform="uppercase"
          color="gray.400"
        >
          {title}
        </Heading>
      </Flex>
      <Box position="absolute" right="3px" top="1px" bg={'gray.700'}>
        <PanelHeaderButton
          isPinned={isPinned}
          icon={
            isPinned ? (
              <BsFillPinFill width={18} />
            ) : (
              <BsFillPinAngleFill width={18} />
            )
          }
          onClick={() => togglePanelPin(type)}
          label="Pin panel"
        />
        <PanelHeaderButton
          icon={<XMarkIcon width={18} />}
          onClick={() => togglePanel(type)}
          label={`Close panel "${title}"`}
        />
      </Box>
    </>
  );
};

export default ProjectBuilderPanelHeader;
