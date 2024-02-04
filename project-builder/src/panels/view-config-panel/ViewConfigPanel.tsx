import {Accordion, Flex} from '@chakra-ui/react';
import {
  FlowmapViewConfigPanel,
  FlowmapViewStateProvider,
} from '@flowmapcity/flowmap';
import {ProjectPanelTypes} from '@sqlrooms/project-config';
import React, {FC, useState} from 'react';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';
type Props = {
  // nothing yet
};
const ViewConfigPanel: FC<Props> = (props) => {
  const {} = props;

  const [accordionIndex, setAccordionIndex] = useState<number[]>([0, 1]);
  const accordionIndexRef = React.useRef(accordionIndex);
  accordionIndexRef.current = accordionIndex;
  // useEffect(() => {
  //   if (tables.length && accordionIndexRef.current[0] === -1) {
  //     setAccordionIndex([0]);
  //   }
  // }, [tables]);

  return (
    <Flex
      flexDir="column"
      overflowX="hidden"
      overflowY="hidden"
      height="100%"
      gap={5}
    >
      <ProjectBuilderPanelHeader
        panelKey={ProjectPanelTypes.VIEW_CONFIGURATION}
      />
      <Flex
        flexDir="column"
        overflowX="hidden"
        overflowY="auto"
        height="100%"
        gap={5}
      >
        <Accordion
          reduceMotion={true}
          flexDir="column"
          display="flex"
          index={accordionIndex}
          onChange={(expandedIndex) =>
            setAccordionIndex(
              Array.isArray(expandedIndex) ? expandedIndex : [expandedIndex],
            )
          }
          allowMultiple={true}
        >
          {/* <AccordionItem>
          <AccordionButton px={0} gap={1}>
            <CustomAccordionIcon />
            <Heading as="h3" size="xs">
              Description
            </Heading>
          </AccordionButton>
          <AccordionPanel pb={5} pt={1} paddingInline="5px">
            <ProjectDescriptionPanel />
          </AccordionPanel>
        </AccordionItem> */}
          <FlowmapViewStateProvider viewId="flowmap">
            <FlowmapViewConfigPanel />
          </FlowmapViewStateProvider>
        </Accordion>
      </Flex>
    </Flex>
  );
};

export default ViewConfigPanel;
