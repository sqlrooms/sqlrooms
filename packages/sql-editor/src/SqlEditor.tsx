import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
  SpinnerPane,
} from '@sqlrooms/ui';
import {
  PlayIcon,
  PlusIcon,
  BookOpenIcon,
  MoreVerticalIcon,
  DownloadIcon,
} from 'lucide-react';
import {TablesList} from '@sqlrooms/components';
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
import {SqlEditorConfig, isMosaicLayoutParent} from '@sqlrooms/project-config';
import {genRandomStr, generateUniqueName} from '@sqlrooms/utils';
import {Table} from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {MosaicNode} from 'react-mosaic-component';
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
  schema?: string;
  isOpen: boolean;
  documentationPanel?: React.ReactNode;
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
  const {
    schema = 'main',
    documentationPanel,
    onAddOrUpdateSqlQuery,
    sqlEditorConfig,
    onChange,
  } = props;
  const duckConn = useDuckConn();

  const [showDocs, setShowDocs] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<Error | null>(null);

  const [mosaicState, setMosaicState] =
    useState<MosaicNode<string>>(MOSAIC_INITIAL_STATE);

  const [results, setResults] = useState<Table>();
  const resultsTableData = useArrowDataTable(results);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>();

  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    if (!duckConn.conn) return;

    try {
      setTablesLoading(true);
      setTablesError(null);
      const tablesList = await getDuckTables(schema);
      setTables(tablesList);
    } catch (e) {
      console.error(e);
      setTablesError(e as Error);
    } finally {
      setTablesLoading(false);
    }
  }, [duckConn.conn, schema]);

  useEffect(() => {
    void fetchTables();
  }, [fetchTables]);

  const runQuery = async (q: string) => {
    const conn = duckConn.conn;
    try {
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

  const handleSelectTable = (table: string) => {
    setSelectedTable(table);
  };

  const handleRunQuery = async () => {
    setSelectedTable(undefined);
    const textarea = document.querySelector(
      `textarea[id="${sqlEditorConfig.selectedQueryId}"]`,
    );
    const selectedText =
      textarea instanceof HTMLTextAreaElement
        ? textarea?.value.substring(
            textarea.selectionStart,
            textarea.selectionEnd,
          )
        : undefined;

    const queryToRun = selectedText || currentQuery;
    await runQuery(queryToRun);
    void fetchTables();
  };

  const getQueryIndexById = (id: string) => {
    return sqlEditorConfig.queries.findIndex((q) => q.id === id);
  };

  const getCurrentQueryIndex = () => {
    return getQueryIndexById(sqlEditorConfig.selectedQueryId);
  };

  const handleTabChange = (value: string) => {
    onChange({
      ...sqlEditorConfig,
      selectedQueryId: value,
    });
  };

  const handleUpdateQuery = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!sqlEditorConfig) return;

    const currentIndex = getCurrentQueryIndex();
    const newQueries = [...sqlEditorConfig.queries];
    if (!newQueries[currentIndex]) return;
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
        void handleRunQueryRef.current();
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

  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);

  const handleCreateTable = useCallback(() => {
    setCreateTableModalOpen(true);
  }, []);

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

  const currentQuery =
    sqlEditorConfig.queries[getCurrentQueryIndex()]?.query ?? DEFAULT_QUERY;

  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);

  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleStartRename = (
    queryId: string,
    currentName: string,
    event: React.MouseEvent,
  ) => {
    event.preventDefault();
    setQueryToRename({id: queryId, name: currentName});
  };

  const handleFinishRename = (newName: string) => {
    if (queryToRename) {
      const newQueries = sqlEditorConfig.queries.map((q) =>
        q.id === queryToRename.id ? {...q, name: newName || q.name} : q,
      );
      onChange({
        ...sqlEditorConfig,
        queries: newQueries,
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
      const prevId = sqlEditorConfig.queries[currentIndex - 1]?.id;
      if (prevId) {
        onChange({
          ...sqlEditorConfig,
          selectedQueryId: prevId,
        });
      }
    }
  };

  const handleNewQuery = () => {
    const newQueries = [...sqlEditorConfig.queries];
    const newQuery = {
      id: genRandomStr(8),
      name: generateUniqueName(
        'Untitled',
        newQueries.map((q) => q.name),
      ),
      query: DEFAULT_QUERY,
    };
    newQueries.push(newQuery);

    onChange({
      ...sqlEditorConfig,
      queries: newQueries,
      selectedQueryId: newQuery.id,
    });
  };

  const views: {[viewId: string]: React.ReactNode | null} = {
    [SqlEditorViews.DOCS]: showDocs ? (documentationPanel ?? null) : null,
    [SqlEditorViews.TABLES_LIST]: tablesLoading ? (
      <SpinnerPane h="100%" />
    ) : tablesError ? (
      <div className="p-4 text-red-500">
        Error loading tables: {tablesError.message}
      </div>
    ) : (
      <TablesList
        schema="information_schema"
        tableNames={tables}
        selectedTable={selectedTable}
        onSelect={handleSelectTable}
      />
    ),
    [SqlEditorViews.QUERY_PANE]: (
      <div className="flex flex-col h-full gap-2">
        <Tabs
          value={sqlEditorConfig.selectedQueryId}
          onValueChange={handleTabChange}
          className="flex flex-col flex-grow overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-border">
            <Button
              size="sm"
              onClick={() => void handleRunQuery()}
              className="uppercase"
            >
              <PlayIcon className="w-4 h-4 mr-2" />
              Run
            </Button>
            <TabsList className="flex-1">
              {sqlEditorConfig.queries.map((q) => (
                <div key={q.id} className="relative">
                  <TabsTrigger value={q.id} className="min-w-[60px] px-6 pr-8">
                    {q.name}
                  </TabsTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center cursor-pointer hover:bg-accent rounded-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVerticalIcon className="h-3 w-3" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(q.id, q.name, e);
                        }}
                      >
                        Rename
                      </DropdownMenuItem>
                      {sqlEditorConfig.queries.length > 1 && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuery(q.id, e);
                          }}
                          className="text-red-500"
                        >
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </TabsList>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNewQuery}
              className="ml-2"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
          {sqlEditorConfig.queries.map((q) => (
            <TabsContent
              key={q.id}
              value={q.id}
              className="flex-grow data-[state=active]:flex-grow"
            >
              <Textarea
                id={q.id}
                value={q.query}
                onChange={handleUpdateQuery}
                className="h-full font-mono text-sm resize-none bg-muted"
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    ),
    resultsBox: (
      <div className="h-full overflow-hidden bg-muted text-sm">
        {loading ? (
          <SpinnerPane h="100%" />
        ) : selectedTable ? (
          <QueryDataTable
            query={`SELECT * FROM ${schema}.${escapeId(selectedTable)}`}
          />
        ) : error ? (
          <div className="w-full h-full p-5 overflow-auto">
            <pre className="text-xs leading-tight text-red-500">{error}</pre>
          </div>
        ) : resultsTableData ? (
          <div className="flex-grow overflow-hidden flex flex-col relative">
            <DataTableVirtualized {...resultsTableData} />
            <div className="absolute bottom-0 right-0 flex gap-2 p-2">
              <Button
                size="sm"
                disabled={!resultsTableData}
                onClick={handleCreateTable}
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Create table
              </Button>
              <Button size="sm" disabled={!results} onClick={handleExport}>
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    ),
  };

  return (
    <>
      <div className="absolute right-12">
        <Button
          size="sm"
          variant={showDocs ? 'secondary' : 'outline'}
          onClick={handleToggleDocs}
        >
          <BookOpenIcon className="w-4 h-4 mr-2" />
          SQL reference
        </Button>
      </div>
      <div className="flex flex-col w-full gap-2">
        <div className="flex items-center gap-2 ml-1 mr-10 mb-2">
          <h2 className="text-lg font-semibold">SQL Editor</h2>
        </div>
        <div className="flex-grow h-full bg-muted">
          <MosaicLayout
            renderTile={(id) => <>{views[id]}</>}
            value={mosaicState}
            onChange={handleMosaicChange}
            initialValue={MOSAIC_INITIAL_STATE}
          />
        </div>
        <CreateTableModal
          query={currentQuery}
          isOpen={createTableModalOpen}
          onClose={() => setCreateTableModalOpen(false)}
          onAddOrUpdateSqlQuery={onAddOrUpdateSqlQuery}
        />
        <DeleteSqlQueryModal
          isOpen={queryToDelete !== null}
          onClose={() => setQueryToDelete(null)}
          onConfirm={() => {
            const newQueries = sqlEditorConfig.queries.filter(
              (q) => q.id !== queryToDelete,
            );
            const deletedIndex = getQueryIndexById(queryToDelete!);

            const selectedQueryId =
              newQueries[Math.min(deletedIndex, newQueries.length - 1)]?.id ||
              newQueries[0]?.id;
            if (selectedQueryId) {
              onChange({
                ...sqlEditorConfig,
                queries: newQueries,
                selectedQueryId,
              });
            }
            setQueryToDelete(null);
          }}
        />
        <RenameSqlQueryModal
          isOpen={queryToRename !== null}
          onClose={() => setQueryToRename(null)}
          initialName={queryToRename?.name ?? ''}
          onRename={handleFinishRename}
        />
      </div>
    </>
  );
};

export default SqlEditor;
