import {
  DataTableVirtualized,
  QueryDataTable,
  useArrowDataTable,
} from '@sqlrooms/data-table';
import {
  DuckQueryError,
  escapeId,
  getDuckTables,
  useDuckDb,
} from '@sqlrooms/duckdb';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SpinnerPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@sqlrooms/ui';
import {genRandomStr, generateUniqueName} from '@sqlrooms/utils';
import {Table} from 'apache-arrow';
import {csvFormat} from 'd3-dsv';
import {saveAs} from 'file-saver';
import {
  BookOpenIcon,
  DownloadIcon,
  MoreVerticalIcon,
  PlayIcon,
  PlusIcon,
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import CreateTableModal, {CreateTableModalProps} from './CreateTableModal';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';
import {TablesList} from './TablesList';
import {SqlEditorSliceConfig} from './SqlEditorSliceConfig';

const DEFAULT_QUERY = '';

export type SqlEditorProps = {
  /** The database schema to use for queries. Defaults to 'main' */
  schema?: string;

  /** Whether the SQL editor is currently visible */
  isOpen: boolean;

  /** Optional component to render SQL documentation in the side panel */
  documentationPanel?: React.ReactNode;

  /** Configuration object containing queries and selected query state */
  sqlEditorConfig: SqlEditorSliceConfig['sqlEditor'];

  /** Callback fired when the SQL editor configuration changes */
  onChange: (config: SqlEditorSliceConfig['sqlEditor']) => void;

  /** Callback fired when the SQL editor should be closed */
  onClose: () => void;

  /** Callback fired when a new table should be created from query results */
  onAddOrUpdateSqlQuery: CreateTableModalProps['onAddOrUpdateSqlQuery'];
};

/**
 * A full-featured SQL editor component with query execution, table management, and results visualization.
 *
 * Features:
 * - Multiple query tabs with save/rename/delete functionality
 * - Query execution with results displayed in a data table
 * - Table browser showing available tables in the schema
 * - Export results to CSV
 * - Create new tables from query results
 * - Optional SQL documentation panel
 * - Keyboard shortcuts (Cmd/Ctrl + Enter to run queries)
 *
 */
const SqlEditor: React.FC<SqlEditorProps> = (props) => {
  const {
    schema = 'main',
    documentationPanel,
    onAddOrUpdateSqlQuery,
    sqlEditorConfig,
    onChange,
  } = props;
  const duckConn = useDuckDb();

  const [showDocs, setShowDocs] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<Error | null>(null);

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

  const handleToggleDocs = useCallback(() => {
    setShowDocs(!showDocs);
  }, [showDocs]);

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
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={20}>
              {tablesLoading ? (
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
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={showDocs ? 50 : 80}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={50}>
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
                              <TabsTrigger
                                value={q.id}
                                className="min-w-[60px] px-6 pr-8"
                              >
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
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                  <div className="h-full overflow-hidden bg-muted text-sm">
                    {loading ? (
                      <SpinnerPane h="100%" />
                    ) : selectedTable ? (
                      <QueryDataTable
                        query={`SELECT * FROM ${schema}.${escapeId(selectedTable)}`}
                      />
                    ) : error ? (
                      <div className="w-full h-full p-5 overflow-auto">
                        <pre className="text-xs leading-tight text-red-500">
                          {error}
                        </pre>
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
                          <Button
                            size="sm"
                            disabled={!results}
                            onClick={handleExport}
                          >
                            <DownloadIcon className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            {showDocs && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30}>
                  {documentationPanel}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
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
