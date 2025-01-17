import {Flex} from '@chakra-ui/react';
import {FC} from 'react';

const ViewConfigPanel: FC = () => {
  // const [accordionIndex, setAccordionIndex] = useState<number[]>([0, 1]);
  // const accordionIndexRef = React.useRef(accordionIndex);
  // accordionIndexRef.current = accordionIndex;
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
      gap={2.5}
    >
      {/* <ProjectBuilderPanelHeader
        panelKey={ProjectPanelTypes.VIEW_CONFIGURATION}
      /> */}
      <Flex
        className="navSideBar"
        flexDir="column"
        overflowX="hidden"
        overflowY="auto"
        height="100%"
        position="relative"
        gap={5}
      ></Flex>
    </Flex>
  );
};

export default ViewConfigPanel;
