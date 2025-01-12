import {
  Alert,
  AlertIcon,
  Button,
  Flex,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Progress,
  Spacer,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import {
  EllipsisHorizontalIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import {SqlQueryDataSource} from '@sqlrooms/project-config';
import {CreateTableModal} from '@sqlrooms/sql-editor';
import {FC, useCallback, useState} from 'react';
import {FiRefreshCw} from 'react-icons/fi';
import {PiFileSql} from 'react-icons/pi';
import {useBaseProjectStore} from '../../ProjectStateProvider';
import {DataSourceStatus} from '../../types';

type Props = {
  queryDataSources: SqlQueryDataSource[];
};
const SqlQueryDataSourcesPanel: FC<Props> = (props) => {
  const {queryDataSources} = props;
  const [selectedDataSource, setSelectedDataSource] =
    useState<SqlQueryDataSource>();
  const editModal = useDisclosure({
    onClose: () => setSelectedDataSource(undefined),
  });
  const dataSourceStates = useBaseProjectStore(
    (state) => state.dataSourceStates,
  );
  const removeSqlQueryDataSource = useBaseProjectStore(
    (state) => state.removeSqlQueryDataSource,
  );

  const handleEdit = useCallback(
    (dataSource: SqlQueryDataSource) => {
      setSelectedDataSource(dataSource);
      editModal.onOpen();
    },
    [removeSqlQueryDataSource, selectedDataSource],
  );

  const handleRemove = useCallback(
    (dataSource: SqlQueryDataSource) => {
      const {tableName} = dataSource;
      removeSqlQueryDataSource(tableName);
    },
    [removeSqlQueryDataSource],
  );

  const addOrUpdateSqlQuery = useBaseProjectStore(
    (state) => state.addOrUpdateSqlQuery,
  );

  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);
  return (
    <Flex flexDir="column" overflow="auto" flexGrow="1">
      <Flex flexDir="column" alignItems="stretch">
        <Button
          size="sm"
          variant="solid"
          color="white"
          leftIcon={<PlusIcon width={15} height={15} />}
          isDisabled={isReadOnly}
          onClick={editModal.onOpen}
        >
          Add
        </Button>
      </Flex>
      <CreateTableModal
        disclosure={editModal}
        editDataSource={selectedDataSource}
        query=""
        onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
      />

      <Flex flexDir="column" overflow="auto" flexGrow="1">
        {queryDataSources.map((dataSource) => (
          <Flex key={dataSource.tableName} p={2} gap={1} flexDir="column">
            <Flex gap={1} cursor="pointer" flexDir="row" alignItems="center">
              <Flex flex="0 0 15px">
                <PiFileSql width="15px" />
              </Flex>
              <Flex flex="1 1 auto" overflow="hidden" textOverflow="ellipsis">
                <Text fontSize="xs" wordBreak="break-word">
                  {dataSource.tableName}
                </Text>
              </Flex>
              <Spacer />

              {!isReadOnly ? (
                <Menu placement={'bottom-start'}>
                  <MenuButton
                    size="xs"
                    as={IconButton}
                    aria-label="Options"
                    icon={<EllipsisHorizontalIcon width="20px" />}
                    variant="ghost"
                    color={'gray.400'}
                  />
                  <Portal>
                    <MenuList minWidth="120px">
                      <MenuItem
                        fontSize={'sm'}
                        icon={<PencilIcon width="15px" />}
                        onClick={() => handleEdit(dataSource)}
                      >
                        Edit
                      </MenuItem>
                      <MenuItem
                        fontSize={'sm'}
                        icon={<FiRefreshCw width="15px" />}
                        isDisabled
                      >
                        Refresh
                      </MenuItem>
                      <MenuItem
                        fontSize={'sm'}
                        icon={<XMarkIcon width="15px" />}
                        onClick={() => handleRemove(dataSource)}
                      >
                        Remove from project
                      </MenuItem>
                    </MenuList>
                  </Portal>
                </Menu>
              ) : null}
            </Flex>
            <Flex flexDir="row" gap={1} alignItems="center">
              {dataSourceStates[dataSource.tableName]?.status ===
              DataSourceStatus.ERROR ? (
                <Alert
                  status="error"
                  fontSize="xs"
                  flex="1 1 auto"
                  py="0"
                  px="1"
                  bg="red.900"
                >
                  <AlertIcon />
                  {dataSourceStates[dataSource.tableName].message}
                </Alert>
              ) : dataSourceStates[dataSource.tableName]?.status ===
                DataSourceStatus.FETCHING ? (
                <Progress
                  width="100%"
                  colorScheme="green"
                  size="xs"
                  isIndeterminate={true}
                />
              ) : null}
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
};

export default SqlQueryDataSourcesPanel;
