import {AddIcon} from '@chakra-ui/icons';
import {
  Accordion,
  AccordionButton,
  AccordionItem,
  AccordionPanel,
  Button,
  Flex,
  Heading,
  HStack,
  Spacer,
  useDisclosure,
} from '@chakra-ui/react';
import {TableCellsIcon} from '@heroicons/react/24/solid';
import {
  DataSourceTypes,
  ProjectPanelTypes,
  SqlQueryDataSource,
} from '@sqlrooms/project-config';
import {createContext, FC, useCallback, useContext} from 'react';
import {PiFileSql} from 'react-icons/pi';

import {FolderIcon} from '@heroicons/react/24/outline';
import {CustomAccordionIcon} from '@sqlrooms/components';
import {useProjectStore} from '@sqlrooms/project-builder';
import ProjectBuilderPanelHeader from '../ProjectBuilderPanelHeader';
import FileDataSourcesPanel from './FileDataSourcesPanel';
import SqlQueryDataSourcesPanel from './SqlQueryDataSourcesPanel';
import TablesPanel from './TablesPanel';

type Props = {
  // no props
};

export const DataSourcesPanelAddDataModalContext = createContext<FC<{
  isOpen: boolean;
  onClose: () => void;
}> | null>(null);

const DataSourcesPanel: FC<Props> = () => {
  const isReadOnly = useProjectStore((state) => state.isReadOnly);
  const AddDataModal = useContext(DataSourcesPanelAddDataModalContext);
  const addDataModal = useDisclosure();
  // const dataSources = useProjectStore(
  //   (state) => state.projectConfig.dataSources,
  // );
  // const tables = useProjectStore((state) => state.tables);
  const projectFiles = useProjectStore((state) => state.projectFiles);
  const queryDataSources = useProjectStore(
    (state) =>
      state.projectConfig.dataSources.filter(
        (ds) => ds.type === DataSourceTypes.enum.sql,
      ) as SqlQueryDataSource[],
  );

  const showFullPanelButton = !projectFiles?.length;

  // const {dbFilesQuery} = useProjectFilesDuckSync();

  // const handleDrop = useCallback(
  //   async (files: File[]) => {
  //     // addDataModal.onToggle();
  //     for (const file of files) {
  //       await db.registerFileHandle(
  //         file.name,
  //         file,
  //         DuckDBDataProtocol.BROWSER_FILEREADER,
  //         true,
  //       );
  //       dbFiles.refetch();
  //     }
  //   },
  //   [dbFiles, db],
  // );

  const handleModalClose = useCallback(() => {
    addDataModal.onClose();
    // dbFilesQuery.refetch();
  }, [
    addDataModal,
    // dbFilesQuery
  ]);

  return (
    <Flex flexDir="column" flexGrow={1} gap={3} height="100%">
      <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.DATA_SOURCES} />
      {showFullPanelButton ? (
        <Spacer minHeight="32px">
          {isReadOnly ? null : (
            <Button
              isDisabled={isReadOnly || !AddDataModal}
              leftIcon={<AddIcon />}
              variant="ghost"
              size="sm"
              onClick={addDataModal.onToggle}
              width="100%"
              height={'100%'}
              alignItems={'center'}
              justifyContent="center"
              cursor="pointer"
            >
              Add
            </Button>
          )}
        </Spacer>
      ) : (
        <>
          {isReadOnly ? null : (
            <Button
              leftIcon={<AddIcon />}
              variant="solid"
              size="sm"
              onClick={addDataModal.onToggle}
              py={4}
            >
              Add
            </Button>
          )}

          <Flex overflow="auto" flexDir="column" alignItems="stretch">
            <Accordion
              reduceMotion={true}
              flexDir="column"
              display="flex"
              allowMultiple={true}
              defaultIndex={[0, 1, 2]}
            >
              <AccordionItem>
                <AccordionButton px={0} gap={1}>
                  <CustomAccordionIcon />
                  <HStack color="gray.400">
                    <FolderIcon width={16} height={16} />
                    <Heading as="h3" fontSize="xs" textTransform="uppercase">
                      Files
                    </Heading>
                  </HStack>
                </AccordionButton>
                <AccordionPanel pb={5} pt={1} paddingInline="5px">
                  <FileDataSourcesPanel />
                </AccordionPanel>
              </AccordionItem>

              {queryDataSources.length > 0 && (
                <AccordionItem>
                  <AccordionButton px={0} gap={1}>
                    <CustomAccordionIcon />
                    <HStack color="gray.400">
                      <PiFileSql width={16} height={16} />
                      <Heading as="h3" fontSize="xs" textTransform="uppercase">
                        SQL QUERIES
                      </Heading>
                    </HStack>
                  </AccordionButton>
                  <AccordionPanel pb={5} pt={1} paddingInline="5px">
                    <SqlQueryDataSourcesPanel
                      queryDataSources={queryDataSources}
                    />
                  </AccordionPanel>
                </AccordionItem>
              )}

              <AccordionItem>
                <AccordionButton px={0} gap={1}>
                  <CustomAccordionIcon />
                  <HStack color="gray.400">
                    <TableCellsIcon width={16} height={16} />
                    <Heading as="h3" fontSize="xs" textTransform="uppercase">
                      TABLES
                    </Heading>
                  </HStack>
                </AccordionButton>
                <AccordionPanel pb={5} pt={1} paddingInline="5px">
                  <TablesPanel />
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Flex>
        </>
      )}

      {/* <FileDropzone onDrop={handleDrop} /> */}
      {/* )} */}
      {AddDataModal ? (
        <AddDataModal isOpen={addDataModal.isOpen} onClose={handleModalClose} />
      ) : null}
    </Flex>
  );
};

export default DataSourcesPanel;
