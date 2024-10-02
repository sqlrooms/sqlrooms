import {Box, Flex, Heading} from '@chakra-ui/react';
import {XMarkIcon} from '@heroicons/react/24/solid';
import {PanelHeaderButton} from '@sqlrooms/components';
import {useBaseProjectStore} from '@sqlrooms/project-builder';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import {FC, useMemo} from 'react';
import {BsFillPinAngleFill, BsFillPinFill} from 'react-icons/bs';

type Props = {
  panelKey: ProjectPanelTypes | string;
  showHeader?: boolean;
  children?: React.ReactNode;
};
const ProjectBuilderPanelHeader: FC<Props> = (props) => {
  const {showHeader = true, panelKey: type, children} = props;
  const projectPanels = useBaseProjectStore((state) => state.projectPanels);
  const {icon: Icon, title} = projectPanels[type];
  const togglePanel = useBaseProjectStore((state) => state.togglePanel);
  const togglePanelPin = useBaseProjectStore((state) => state.togglePanelPin);
  const pinnedPanels = useBaseProjectStore(
    (state) => state.projectConfig.layout.pinned,
  );
  const isPinned = useMemo(
    () => pinnedPanels?.includes(type),
    [pinnedPanels, type],
  );
  return (
    <>
      <Flex flexDir="row" width="100%" alignItems="center" gap={2}>
        {showHeader && (
           <>
            <Icon width="20px" />
            <Heading
              as="h2"
              fontSize={'xs'}
              textTransform="uppercase"
              color="gray.400"
            >
              {title}
              </Heading>
            </>
          )}
        {children}
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
