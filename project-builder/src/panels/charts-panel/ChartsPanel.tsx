import {AddIcon, QuestionOutlineIcon} from '@chakra-ui/icons';
import {
  Accordion,
  AccordionButton,
  AccordionItem,
  AccordionPanel,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Spacer,
  Tooltip,
} from '@chakra-ui/react';
import {CustomAccordionIcon} from '@sqlrooms/components';
import {
  FlowmapViewStateProvider,
  useFlowmapViewState,
} from '@flowmapcity/flowmap';
import {getFlowsFilterClause} from '@flowmapcity/flowmap/src/views/flowmap/data/layers-data';
import {ChartConfig, ProjectPanelTypes} from '@sqlrooms/project-config';
import {range} from 'd3-array';
import {FC, useMemo, useState} from 'react';
import {ImEnlarge2} from 'react-icons/im';
import {useProjectStore} from '../../ProjectStateProvider';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';
import ChartView from './ChartView';
import EnlargedChartModal from './EnlargedChartModal';
import {getDefaultCharts} from './getDefaultCharts';

type Props = {
  // no props
};

const ChartsPanel: FC<Props> = () => {
  const projectCharts = useProjectStore((state) => state.projectConfig.charts);
  const dataReady = useProjectStore((state) => state.areDatasetsReady());

  const isReadOnly = useProjectStore((state) => state.isReadOnly);
  const isDataAvailable = useFlowmapViewState((s) => s.isDataAvailable());

  // const columnMapping = useProjectStore(
  //   (state) => state.projectConfig.views[0]?.columnMapping,
  // );

  const flowsFilterClause = useFlowmapViewState((state) =>
    getFlowsFilterClause(state),
  );
  const preparedDataSchema = useFlowmapViewState(
    (state) => state.preparedDataSchema,
  );
  const charts = useMemo(
    () => [
      ...(isDataAvailable
        ? getDefaultCharts(preparedDataSchema, flowsFilterClause)
        : []),
      ...(projectCharts ?? []),
    ],
    [isDataAvailable, preparedDataSchema, flowsFilterClause, projectCharts],
  );

  const accordionInitialOpen = useMemo(
    () => range(0, charts ? charts.length + 1 : 1),
    [charts],
  );

  const [enlargedChart, setEnlargedChart] = useState<ChartConfig>();
  return (
    <Flex
      flexDir="column"
      overflowX="hidden"
      overflowY="auto"
      height="100%"
      gap={3}
    >
      <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.CHARTS} />
      <Flex
        flexDir="column"
        overflowX="hidden"
        overflowY="hidden"
        height="100%"
        gap={3}
      >
        {isReadOnly ? null : (
          <Button
            leftIcon={<AddIcon />}
            variant="solid"
            size="sm"
            // onClick={}
            isDisabled={true}
            py={4}
          >
            Add
          </Button>
        )}
        {dataReady ? (
          <Flex
            flexGrow="1"
            flexDir="column"
            overflowX="hidden"
            overflowY="auto"
            height="100%"
          >
            <Accordion
              reduceMotion={true}
              flexDir="column"
              display="flex"
              allowMultiple={true}
              defaultIndex={accordionInitialOpen}
            >
              {charts.map((chart, i) => (
                <AccordionItem key={i} position="relative">
                  <Flex>
                    <AccordionButton px={0} gap={1}>
                      <CustomAccordionIcon />
                      <Heading
                        as="h3"
                        fontSize="xs"
                        textTransform="uppercase"
                        color="gray.400"
                      >
                        {`${chart.title}`}
                      </Heading>
                    </AccordionButton>
                    <Spacer />
                    <HStack pr={1} pb={'4px'}>
                      {chart.description ? (
                        <Tooltip
                          hasArrow
                          placement="right"
                          label={chart.description}
                        >
                          <Icon
                            as={QuestionOutlineIcon}
                            color="gray.400"
                            _hover={{color: 'white'}}
                            w={'14px'}
                            h={'14px'}
                            cursor="pointer"
                          />
                        </Tooltip>
                      ) : null}
                      <Tooltip
                        hasArrow
                        placement="right"
                        label={'Enlarge chart'}
                      >
                        <IconButton
                          onClick={() => setEnlargedChart(chart)}
                          color="gray.400"
                          variant="ghost"
                          size="xs"
                          icon={<ImEnlarge2 size="10px" />}
                          aria-label="Enlarge chart"
                        />
                      </Tooltip>
                    </HStack>
                  </Flex>
                  <AccordionPanel pb={5} pt={1} paddingInline="5px">
                    <ChartView chart={chart} />
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </Flex>
        ) : null}
      </Flex>
      <EnlargedChartModal
        chart={enlargedChart}
        onClose={() => setEnlargedChart(undefined)}
      />
    </Flex>
  );
};

const FlowmapChartsPanel = () => {
  return (
    <FlowmapViewStateProvider viewId="flowmap">
      <ChartsPanel />
    </FlowmapViewStateProvider>
  );
};

export default FlowmapChartsPanel;
