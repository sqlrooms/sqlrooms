import { DownloadIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  ModalCloseButton,
  Spacer,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Textarea,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { BookOpenIcon, EllipsisVerticalIcon, PlayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { SpinnerPane, TablesList } from '@sqlrooms/components';
import {
  DataTableVirtualized,
  QueryDataTable,
  useArrowDataTable,
} from '@sqlrooms/data-table';
import {
  DuckQueryError,
  escapeId,
  getDuckTables,
  useDuckConn,
} from '@sqlrooms/duckdb';
import { MosaicLayout } from '@sqlrooms/layout';
import { SqlEditorConfig, isMosaicLayoutParent } from '@sqlrooms/project-config';
import { genRandomStr, generateUniqueName } from '@sqlrooms/utils';
import { useQuery } from '@tanstack/react-query';
import { Table } from 'apache-arrow';
import { csvFormat } from 'd3-dsv';
import { saveAs } from 'file-saver';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MosaicNode } from 'react-mosaic-component';
import CreateTableModal, {
  Props as CreateTableModalProps,
} from './CreateTableModal';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';

enum SqlEditorViews {
  DOCS = 'docs',
  TABLES_LIST = 'tablesList',
  QUERY_PANE = 'queryPane',
}

export type Props = {
  schema: string;
  isOpen: boolean;
  documentationPanel?: JSX.Element;
  sqlEditorConfig: SqlEditorConfig;
  onChange: (config: SqlEditorConfig) => void;
  onClose: () => void;
  onAddOrUpdateSqlQuery: CreateTableModalProps['onAddOrUpdateSqlQuery'];
};

const DOCS_PANE_SPLIT_PERCENTAGE = 30;
const DEFAULT_QUERY = '';

const MOSAIC_INITIAL_STATE: MosaicNode<string> = {
  direction: 'column',
  first: {
    direction: 'row',
    second: SqlEditorViews.TABLES_LIST,
    first: SqlEditorViews.QUERY_PANE,
    splitPercentage: 60,
  },
  second: 'resultsBox',
  splitPercentage: 50,
};

const SqlEditor: React.FC<Props> = (props) => {
  const { schema, documentationPanel, onAddOrUpdateSqlQuery, sqlEditorConfig, onChange } = props;
  const duckConn = useDuckConn();

  const [showDocs, setShowDocs] = useState(false);

  const [mosaicState, setMosaicState] =
    useState<MosaicNode<string>>(MOSAIC_INITIAL_STATE);

  const [results, setResults] = useState<Table>();
  const resultsTableData = useArrowDataTable(results);
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>();

  useEffect(() => {
    return () => {
      // on unmount
      toast.closeAll();
    };
  }, [toast]);

  // const tableNames = useBaseProjectStore((state) =>
  //   state.tables.map((t) => t.tableName),
  // );

  const [error, setError] = useState<string | null>(null);

  const tablesQuery = useQuery(
    ['sql-editor-tables', schema],
    async () => {
      try {
        return await getDuckTables(schema);
      } catch (e) {
        console.error(e);
        toast({
          title: 'Error fetching tables',
          status: 'error',
          isClosable: true,
        });
        return [];
      }
    },
    {
      cacheTime: 0,
      suspense: false,
      keepPreviousData: true,
      refetchOnWindowFocus: true,
      enabled: !!duckConn.conn,
      refetchOnMount: true,
    },
  );

  const runQuery = async (q: string) => {
    const conn = duckConn.conn;
    try {
      toast.closeAll();
      setError(null);
      setLoading(true);
      await conn.query(`SET search_path = ${schema}`);
      const results = await conn.query(q);
      await conn.query(`SET search_path = main`);
      setResults(results);
    } catch (e) {
      setResults(undefined);
      setError(
        (e instanceof DuckQueryError
          ? e.getMessageForUser()
          : 'Query failed') ?? e,
      );
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  const handleSelectTable = async (table: string) => {
    setSelectedTable(table);
    //await runQuery(`SELECT * FROM ${table}`);
  };
  const handleRunQuery = async () => {
    setSelectedTable(undefined);
    const textarea = document.querySelector(`textarea[id="${sqlEditorConfig.selectedQueryId}"]`);
    if (!textarea) return;
    const selectedText = textarea?.value.substring(
      textarea.selectionStart,
      textarea.selectionEnd
    );

    const queryToRun = selectedText || currentQuery;
    await runQuery(queryToRun);
    tablesQuery.refetch();
  };

  const getQueryIndexById = (id: string) => {
    return sqlEditorConfig.queries.findIndex(q => q.id === id);
  };

  const getCurrentQueryIndex = () => {
    return getQueryIndexById(sqlEditorConfig.selectedQueryId);
  };

  const handleTabChange = (index: number) => {
    onChange({
      ...sqlEditorConfig,
      selectedQueryId: sqlEditorConfig.queries[index].id
    });
  };

  const handleUpdateQuery = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!sqlEditorConfig) return;

    const currentIndex = getCurrentQueryIndex();
    const newQueries = [...sqlEditorConfig.queries];
    newQueries[currentIndex] = {
      ...newQueries[currentIndex],
      query: e.target.value,
    };

    onChange({
      ...sqlEditorConfig,
      queries: newQueries,
    });
  };
  const handleRunQueryRef = useRef(handleRunQuery);
  handleRunQueryRef.current = handleRunQuery;

  useEffect(() => {
    const handleKeyDown = (evt: Event) => {
      if (
        evt instanceof KeyboardEvent &&
        evt.key === 'Enter' &&
        (evt.metaKey || evt.ctrlKey || evt.shiftKey)
      ) {
        handleRunQueryRef.current();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleExport = () => {
    if (!results) return;
    const blob = new Blob([csvFormat(results.toArray())], {
      type: 'text/plain;charset=utf-8',
    });
    saveAs(blob, `export-${genRandomStr(5)}.csv`);
  };

  const createTableModal = useDisclosure();

  const handleCreateTable = useCallback(async () => {
    createTableModal.onOpen();
  }, [createTableModal]);

  const handleMosaicChange = (node: MosaicNode<string> | null) => {
    if (node) {
      setMosaicState(node);
    }
  };
  const handleToggleDocs = useCallback(() => {
    if (
      isMosaicLayoutParent(mosaicState) &&
      mosaicState.second === SqlEditorViews.DOCS
    ) {
      setMosaicState(mosaicState.first);
      setShowDocs(false);
    } else {
      setMosaicState({
        first: mosaicState,
        second: 'docs',
        direction: 'row',
        splitPercentage: 100 - DOCS_PANE_SPLIT_PERCENTAGE,
      });
      setShowDocs(true);
    }
  }, [mosaicState]);

  const currentQuery = sqlEditorConfig.queries[getCurrentQueryIndex()]?.query ?? DEFAULT_QUERY;

  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);

  const [queryToRename, setQueryToRename] = useState<{ id: string, name: string } | null>(null);

  const handleStartRename = (queryId: string, currentName: string, event: React.MouseEvent) => {
    event.preventDefault();
    setQueryToRename({ id: queryId, name: currentName });
  };

  const handleFinishRename = (newName: string) => {
    if (queryToRename) {
      const newQueries = sqlEditorConfig.queries.map(q =>
        q.id === queryToRename.id
          ? { ...q, name: newName || q.name }
          : q
      );
      onChange({
        ...sqlEditorConfig,
        queries: newQueries
      });
    }
    setQueryToRename(null);
  };

  const handleDeleteQuery = (queryId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const currentIndex = getQueryIndexById(queryId);
    setQueryToDelete(queryId);

    // Pre-select the previous query if we're deleting the current one
    if (queryId === sqlEditorConfig.selectedQueryId && currentIndex > 0) {
      onChange({
        ...sqlEditorConfig,
        selectedQueryId: sqlEditorConfig.queries[currentIndex - 1].id
      });
    }
  };

  const handleNewQuery = () => {
    const newQueries = [...sqlEditorConfig.queries];
    const newQuery = {
      id: genRandomStr(8),
      name: generateUniqueName('Untitled', newQueries.map(q => q.name)),
      query: DEFAULT_QUERY
    };
    newQueries.push(newQuery);

    onChange({
      ...sqlEditorConfig,
      queries: newQueries,
      selectedQueryId: newQuery.id
    });
  };

  const views: { [viewId: string]: JSX.Element | null } = {
    [SqlEditorViews.DOCS]: showDocs ? documentationPanel ?? null : null,
    [SqlEditorViews.TABLES_LIST]: (
      <TablesList
        schema="information_schema"
        tableNames={tablesQuery.data ?? []}
        selectedTable={selectedTable}
        onSelect={handleSelectTable}
      />
    ),
    [SqlEditorViews.QUERY_PANE]: (
      <>
        <Flex flexDir="column" height="100%" gap="2">

          <Tabs
            onChange={handleTabChange}
            index={getCurrentQueryIndex()}
            size="sm"
            display="flex"
            flexDir="column"
            flexGrow={1}
            variant="enclosed-colored"
            overflow="hidden"
          >

            <TabList flexWrap="wrap">
              <Button
                aria-label="Run query"
                size="sm"
                textTransform="uppercase"
                colorScheme="blue"
                leftIcon={<PlayIcon width="16px" height="16px" />}
                onClick={handleRunQuery}
                _hover={{ bg: 'gray.600' }}
                _active={{ bg: 'gray.500' }}
              >
                Run
              </Button>
              <Spacer />
              {sqlEditorConfig.queries.map((q) => (
                <Tab
                  key={q.id}
                  position="relative"
                  minWidth="60px"
                  px={6}
                >
                  <span>{q.name}</span>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      aria-label="Query options"
                      icon={<EllipsisVerticalIcon width="12px" height="12px" />}
                      size="xs"
                      variant="ghost"
                      position="absolute"
                      right={0}
                      top="50%"
                      transform="translateY(-50%)"
                      onClick={(e) => e.stopPropagation()} // Prevent tab selection
                      _hover={{ bg: 'gray.600' }}
                    />
                    <MenuList minW="120px">
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(q.id, q.name, e);
                        }}
                        fontSize="sm"
                      >
                        Rename
                      </MenuItem>
                      {sqlEditorConfig.queries.length > 1 && (
                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuery(q.id, e);
                          }}
                          color="red.300"
                          fontSize="sm"
                        >
                          Delete
                        </MenuItem>
                      )}
                    </MenuList>
                  </Menu>
                </Tab>
              ))}
              <IconButton
                aria-label="New query"
                size="sm"
                icon={<PlusIcon width="16px" height="16px" />}
                onClick={handleNewQuery}
                ml={2}
              />
            </TabList>
            <TabPanels flexGrow={1}>
              {sqlEditorConfig.queries.map((q) => (
                <TabPanel key={q.id} p={0} h="100%">
                  <Textarea
                    id={q.id}
                    flexGrow="1"
                    fontSize="xs"
                    fontFamily="mono"
                    value={q.query}
                    onChange={handleUpdateQuery}
                    bg={'gray.800'}
                    color={'gray.100'}
                    width="100%"
                    height="100%"
                    resize="none"
                  />
                </TabPanel>
              ))}
            </TabPanels>
          </Tabs>
        </Flex>
      </>
    ),
    resultsBox: (
      <Flex
        height={'100%'}
        overflow="hidden"
        background={'gray.800'}
        fontSize="xs"
      >
        {loading ? (
          <SpinnerPane h="100%" />
        ) : selectedTable ? (
          <QueryDataTable
            query={`SELECT * FROM ${schema}.${escapeId(selectedTable)}`}
          />
        ) : error ? (
          <Flex w="100%" h="100%" p={5} overflow="auto">
            <Box as="pre" fontSize={12} lineHeight={1.3} color="error">
              {error}
            </Box>
          </Flex>
        ) : resultsTableData ? (
          <Flex flexGrow={1} overflow="hidden" flexDir="column" position="relative">
            <DataTableVirtualized {...resultsTableData} />
            <Flex position="absolute" bottom={0} right={0}>
              <Button
                aria-label="Create table"
                size="sm"
                isDisabled={!resultsTableData}
                leftIcon={<PlusIcon width="16px" height="16px" />}
                onClick={handleCreateTable}
                _hover={{ bg: 'gray.600' }}
                _active={{ bg: 'gray.500' }}
              >
                Create table
              </Button>
              <Button
                disabled={!Boolean(results)}
                size={'sm'}
                leftIcon={<Icon as={DownloadIcon} h={5} w={5} />}
                onClick={handleExport}
              >
                Export
              </Button>


            </Flex>
          </Flex>
        ) : null}
      </Flex>
    ),
  };

  return (
    <>
      <Box position="absolute" right={50}>
        <Button
          disabled={!Boolean(results)}
          size={'sm'}
          leftIcon={<Icon as={BookOpenIcon} h={5} w={5} />}
          onClick={handleToggleDocs}
          bg={showDocs ? 'gray.600' : 'gray.700'}
        >
          SQL reference
        </Button>
      </Box>
      <Flex alignItems="stretch" width="100%" flexDirection="column" gap={2}>
        <ModalCloseButton />
        <HStack ml={1} mr={10} mb={2}>
          <Heading size="md">SQL Editor</Heading>
        </HStack>
        <Box flexGrow={1} height="100%" bg="gray.800">
          <MosaicLayout
            renderTile={(id) => views[id] ?? <></>}
            value={mosaicState}
            onChange={handleMosaicChange}
          />
        </Box>
        <CreateTableModal
          query={currentQuery}
          disclosure={createTableModal}
          onAddOrUpdateSqlQuery={onAddOrUpdateSqlQuery}
        />
        <DeleteSqlQueryModal
          isOpen={queryToDelete !== null}
          onClose={() => setQueryToDelete(null)}
          onConfirm={() => {
            const newQueries = sqlEditorConfig.queries.filter(q => q.id !== queryToDelete);
            const deletedIndex = getQueryIndexById(queryToDelete!);

            onChange({
              ...sqlEditorConfig,
              queries: newQueries,
              selectedQueryId: newQueries[Math.min(deletedIndex, newQueries.length - 1)]?.id || newQueries[0].id
            });
            setQueryToDelete(null);
          }}
        />
        <RenameSqlQueryModal
          isOpen={queryToRename !== null}
          onClose={() => setQueryToRename(null)}
          initialName={queryToRename?.name ?? ''}
          onRename={handleFinishRename}
        />
      </Flex>
    </>
  );
};

export default SqlEditor;
