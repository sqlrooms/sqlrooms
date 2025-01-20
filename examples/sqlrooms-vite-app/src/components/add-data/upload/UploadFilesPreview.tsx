import {
  Flex,
  Grid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react';
import {EditableText} from '@sqlrooms/components';
import {QueryDataTable} from '@sqlrooms/data-table';
import {escapeVal, getDuckTables} from '@sqlrooms/duckdb';
import {useQuery} from '@tanstack/react-query';
import {
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {DEFAULT_PROJECT_TITLE} from '@sqlrooms/project-config';
import {
  convertToUniqueColumnOrTableName,
  convertToUniqueS3FolderPath,
  convertToUniqueS3ObjectName,
  splitFilePath,
} from '@sqlrooms/utils';
import {produce} from 'immer';
import useProjectStore from '../../../store/DemoProjectStore';

const DEFAULT_TABLE_NAME = 'unnamed_table';
const DEFAULT_FILE_NAME = 'unnamed_file';

type Props = {
  addedFiles: AddedFileInfo[];
  tableNames?: string[];
  onSetTableNames: Dispatch<SetStateAction<string[] | undefined>>;
  onSetAddedFiles: Dispatch<SetStateAction<AddedFileInfo[] | undefined>>;
};

export type AddedFileInfo = {
  filePath: string;
  duckdbFileName: string;
  file: File;
};

// const Warning: FC<{text: string} & IconProps> = ({text, ...rest}) => (
//   <Tooltip hasArrow placement="right" label={text} backgroundColor="error">
//     <Icon
//       as={WarningTwoIcon}
//       w={4}
//       h={4}
//       color={'error'}
//       cursor="pointer"
//       {...rest}
//     />
//   </Tooltip>
// );

const UploadFilesPreview: FC<Props> = (props) => {
  const {addedFiles, tableNames, onSetAddedFiles, onSetTableNames} = props;
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const projectTitle = useProjectStore((state) => state.projectConfig.title);
  const setProjectFolder = useProjectStore((state) => state.setProjectFolder);
  const projectFolder = useProjectStore((state) => state.getProjectFolder());
  const ErrorBoundary = useProjectStore((state) => state.CustomErrorBoundary);

  useEffect(() => {
    setSelectedFileIndex(0);
  }, []);

  const duckdbTablesQuery = useQuery(
    ['duckdbTables'],
    async () => await getDuckTables(),
  );
  const existingTables = duckdbTablesQuery?.data;

  const handleSetTableName = useCallback(
    (i: number, name: string) => {
      const nextName = convertToUniqueColumnOrTableName(
        name.trim() || DEFAULT_TABLE_NAME,
        existingTables,
      );
      onSetTableNames(
        produce((draft) => {
          if (!draft) draft = [];
          draft[i] = nextName;
          return draft;
        }),
      );
      return nextName; // Pass corrected value to editable text
    },
    [existingTables, onSetTableNames],
  );

  const handleSetProjectFolder = useCallback(
    (name: string) => {
      const nextName = convertToUniqueS3FolderPath(
        name.trim() || projectTitle || DEFAULT_PROJECT_TITLE,
      );
      setProjectFolder(nextName);
      return nextName; // Pass corrected value to editable text
    },
    [setProjectFolder, projectTitle],
  );

  const handleSetFileName = useCallback(
    (i: number, name: string) => {
      const nextName = convertToUniqueS3ObjectName(
        name.trim() || DEFAULT_FILE_NAME,
        [],
      );
      onSetAddedFiles(
        produce((draft) => {
          const fileInfo = draft?.[i];
          if (fileInfo) {
            fileInfo.filePath = nextName;
          }
          return draft;
        }),
      );
      return nextName; // Pass corrected value to editable text
    },
    [onSetAddedFiles],
  );

  return (
    <>
      <Flex flexDir="column" gap="3" height="100%" fontSize="sm">
        <Flex alignItems="center" gap="1">
          <Text color="gray.400" whiteSpace="nowrap">
            Project folder:
          </Text>
          <EditableText
            textAlign="left"
            value={projectFolder}
            onChange={handleSetProjectFolder}
            error={undefined}
            isLoading={false}
          />
        </Flex>
        <Tabs
          index={selectedFileIndex}
          onChange={setSelectedFileIndex}
          variant="enclosed-colored"
          flexGrow={1}
          display="flex"
          flexDir="column"
          width="100%"
          height="100%"
          overflow="hidden"
        >
          <TabList>
            {addedFiles.map(({filePath}, i) => (
              <Tab fontSize="sm" key={i} maxWidth="250px" overflow="hidden">
                {splitFilePath(filePath).name}
              </Tab>
            ))}
          </TabList>
          <TabPanels
            display="flex"
            width="100%"
            height="100%"
            overflow="hidden"
          >
            {addedFiles.map(({filePath}, i) => (
              <TabPanel
                key={filePath}
                width="100%"
                height="100%"
                display="flex"
                overflow="hidden"
                p={0}
              >
                <Flex grow="1" flexDir="column" overflow="hidden">
                  <Flex flexDir="column" gap="3" overflow="auto" flexGrow="1">
                    <Grid
                      templateColumns="1fr auto"
                      columnGap={1}
                      alignItems="center"
                      alignSelf="flex-start"
                      justifyItems="flex-start"
                      pt={4}
                      fontSize="sm"
                    >
                      <Text color="gray.400" whiteSpace="nowrap">
                        File path:
                      </Text>
                      <Flex px="2" alignItems="center">
                        <Text>{projectFolder}</Text>
                        <EditableText
                          textAlign="left"
                          value={addedFiles[i]?.filePath ?? ''}
                          onChange={(name) => handleSetFileName(i, name)}
                          error={undefined}
                          isLoading={false}
                        />
                      </Flex>
                      <Text color="gray.400" whiteSpace="nowrap">
                        Table name:
                      </Text>
                      <EditableText
                        width={400}
                        textAlign="left"
                        value={tableNames?.[i] ?? ''}
                        onChange={(name) => handleSetTableName(i, name)}
                        error={undefined}
                        isLoading={false}
                      />
                    </Grid>
                    <Flex flexGrow="1" overflow="hidden">
                      <ErrorBoundary>
                        <QueryDataTable
                          query={`SELECT * FROM ${escapeVal(
                            addedFiles[selectedFileIndex]?.duckdbFileName ?? '',
                          )}`}
                        />
                      </ErrorBoundary>
                    </Flex>
                  </Flex>
                </Flex>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Flex>
    </>
  );
};

export default UploadFilesPreview;
