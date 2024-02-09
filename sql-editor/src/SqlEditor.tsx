import {DownloadIcon} from '@chakra-ui/icons';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  ModalCloseButton,
  Spacer,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import {BookOpenIcon, PlayIcon, PlusIcon} from '@heroicons/react/24/outline';
import {SpinnerPane, TablesList} from '@sqlrooms/components';
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
import {MosaicLayout} from '@sqlrooms/layout';
import {DocumentationPanel} from '@sqlrooms/project-builder';
import {isMosaicLayoutParent} from '@sqlrooms/project-config';
import {genRandomStr} from '@sqlrooms/utils';
import {useQuery} from '@tanstack/react-query';
import {Table} from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {MosaicNode} from 'react-mosaic-component';
import CreateTableModal from './CreateTableModal';

enum SqlEditorViews {
  DOCS = 'docs',
  TABLES_LIST = 'tablesList',
  QUERY_PANE = 'queryPane',
}

export interface Props {
  schema: string;
  isOpen: boolean;
  onClose: () => void;
}

const LOCAL_STORAGE_QUERY_KEY = 'sqlEditor.query';
const DOCS_PANE_SPLIT_PERCENTAGE = 30;
const DEFAULT_QUERY = `SELECT 1`;

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
  const {schema} = props;
  const duckConn = useDuckConn();

  const [showDocs, setShowDocs] = useState(false);

  const [mosaicState, setMosaicState] =
    useState<MosaicNode<string>>(MOSAIC_INITIAL_STATE);

  const [query, setQuery] = useState(
    window.localStorage.getItem(LOCAL_STORAGE_QUERY_KEY) ?? DEFAULT_QUERY,
  );
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
    await runQuery(query);
    tablesQuery.refetch();
  };

  const handleUpdateQuery = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    window.localStorage.setItem(LOCAL_STORAGE_QUERY_KEY, e.target.value);
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

  const views: {[viewId: string]: JSX.Element | null} = {
    [SqlEditorViews.DOCS]: showDocs ? (
      <Flex flexDir="column" height="100%">
        <DocumentationPanel showHeader={false} pageUrl="/sql" />
      </Flex>
    ) : null,
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
          <HStack>
            <Button
              aria-label="Run query"
              size="sm"
              textTransform="uppercase"
              colorScheme="blue"
              leftIcon={<PlayIcon width="16px" height="16px" />}
              onClick={handleRunQuery}
              _hover={{bg: 'gray.600'}}
              _active={{bg: 'gray.500'}}
            >
              Run
            </Button>

            <Spacer />

            <Button
              aria-label="Create table"
              size="sm"
              isDisabled={!resultsTableData}
              leftIcon={<PlusIcon width="16px" height="16px" />}
              onClick={handleCreateTable}
              _hover={{bg: 'gray.600'}}
              _active={{bg: 'gray.500'}}
            >
              New table
            </Button>
            <Button
              disabled={!Boolean(results)}
              size={'sm'}
              leftIcon={<Icon as={DownloadIcon} h={5} w={5} />}
              onClick={handleExport}
            >
              Export
            </Button>
          </HStack>
          <Textarea
            flexGrow="1"
            fontSize="xs"
            fontFamily="mono"
            value={query}
            onChange={handleUpdateQuery}
            bg={'gray.800'}
            color={'gray.100'}
            width="100%"
            height="100%"
            resize="none"
          />
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
          <DataTableVirtualized {...resultsTableData} />
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
        <CreateTableModal query={query} disclosure={createTableModal} />
      </Flex>
    </>
  );
};

export default SqlEditor;
