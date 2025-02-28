import {DataTableVirtualized, QueryDataTable} from '@sqlrooms/data-table';
import {escapeId} from '@sqlrooms/duckdb';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  SpinnerPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {
  BookOpenIcon,
  DownloadIcon,
  MoreVerticalIcon,
  PlayIcon,
  PlusIcon,
} from 'lucide-react';
import React, {useCallback, useEffect, useState} from 'react';
import CreateTableModal from './CreateTableModal';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';
import {useStoreWithSqlEditor} from './SqlEditorSlice';
import {TablesList} from './TablesList';
import {SqlMonacoEditor} from './components/internal/SqlMonacoEditor';
import {
  useTableManagement,
  useQueryExecution,
  useQueryTabManagement,
  useMonacoEditor,
} from './hooks';

const DEFAULT_QUERY = '';

export type SqlEditorProps = {
  /** The database schema to use for queries. Defaults to 'main' */
  schema?: string;

  /** Whether the SQL editor is currently visible */
  isOpen: boolean;

  /** Optional component to render SQL documentation in the side panel */
  documentationPanel?: React.ReactNode;

  /** Callback fired when the SQL editor should be closed */
  onClose: () => void;
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
const SqlEditorBase: React.FC<SqlEditorProps> = (props) => {
  const {schema = 'main', documentationPanel} = props;

  // Store access - directly use the selector
  const addOrUpdateSqlQuery = useStoreWithSqlEditor(
    (state) => state.sqlEditor.addOrUpdateSqlQuery,
  );

  // UI state
  const [showDocs, setShowDocs] = useState(false);
  const [createTableModalOpen, setCreateTableModalOpen] = useState(false);

  // Custom hooks
  const {
    tables,
    tablesLoading,
    tablesError,
    tableSchemas,
    tableSamples,
    selectedTable,
    fetchTables,
    handleSelectTable,
  } = useTableManagement();

  const {results, resultsTableData, loading, error, runQuery, exportResults} =
    useQueryExecution(schema);

  const {
    queries,
    selectedQueryId,
    queryToDelete,
    queryToRename,
    getCurrentQuery,
    handleTabChange,
    handleUpdateQuery,
    handleNewQuery,
    handleStartRename,
    handleFinishRename,
    handleDeleteQuery,
    handleConfirmDeleteQuery,
    setQueryToDelete,
    setQueryToRename,
  } = useQueryTabManagement(DEFAULT_QUERY);

  const {editorInstances, handleEditorMount, getQueryText, setRunQueryHandler} =
    useMonacoEditor();

  // Get the current query text
  const currentQuery = getCurrentQuery();

  // Handle run query logic
  const handleRunQuery = useCallback(async () => {
    // Clear selected table when running a query
    handleSelectTable(undefined);

    // Get the query text (either selected text or the entire query)
    const queryToRun = getQueryText(selectedQueryId, currentQuery);

    // Run the query and refresh tables list
    await runQuery(queryToRun);
  }, [
    handleSelectTable,
    getQueryText,
    selectedQueryId,
    currentQuery,
    runQuery,
  ]);

  // Set up the run query handler reference for keyboard shortcuts
  useEffect(() => {
    setRunQueryHandler(handleRunQuery);
  }, [handleRunQuery, setRunQueryHandler]);

  // Check if table schemas are empty and refetch if needed
  useEffect(() => {
    if (Object.keys(tableSchemas).length === 0) {
      void fetchTables();
    }
  }, [fetchTables, tableSchemas]);

  // Handle toggle documentation panel
  const handleToggleDocs = useCallback(() => {
    setShowDocs(!showDocs);
  }, [showDocs]);

  // Handle create table from query results
  const handleCreateTable = useCallback(() => {
    setCreateTableModalOpen(true);
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      <div className="absolute right-12 top-2">
        {documentationPanel ? (
          <Button
            size="sm"
            variant={showDocs ? 'secondary' : 'outline'}
            onClick={handleToggleDocs}
          >
            <BookOpenIcon className="w-4 h-4 mr-2" />
            SQL reference
          </Button>
        ) : (
          <a
            href="https://duckdb.org/docs/sql/introduction"
            target="_blank"
            rel="noreferrer"
          >
            <Button size="sm" variant={'outline'}>
              <BookOpenIcon className="w-4 h-4 mr-2" />
              SQL reference
            </Button>
          </a>
        )}
      </div>
      <div className="flex flex-col w-full gap-2 h-full">
        <div className="flex items-center gap-2 ml-1 mr-10 mb-2">
          <h2 className="text-lg font-semibold">SQL Editor</h2>
        </div>
        <div className="flex-grow h-full bg-muted">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Main panel - takes full width when docs not shown, or 70% when docs shown */}
            <ResizablePanel defaultSize={showDocs ? 70 : 100}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={50} className="flex flex-row">
                  <ResizablePanelGroup direction="horizontal">
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
                    <ResizablePanel
                      defaultSize={80}
                      className="flex flex-col overflow-hidden"
                    >
                      <Tabs
                        value={selectedQueryId}
                        onValueChange={handleTabChange}
                        className="flex flex-col h-full overflow-hidden"
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
                            {queries.map((q: any) => (
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
                                    {queries.length > 1 && (
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
                        {queries.map((q: any) => (
                          <TabsContent
                            key={q.id}
                            value={q.id}
                            className="relative flex-grow data-[state=active]:flex flex-col h-full"
                          >
                            <div className="flex-grow h-full w-full absolute inset-0">
                              <SqlMonacoEditor
                                value={q.query}
                                onChange={handleUpdateQuery}
                                className="h-full w-full flex-grow"
                                options={{
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  minimap: {enabled: false},
                                  wordWrap: 'on',
                                  // Enable keyboard shortcuts
                                  quickSuggestions: true,
                                  suggestOnTriggerCharacters: true,
                                }}
                                onMount={(editor, monaco) => {
                                  handleEditorMount(
                                    editor,
                                    monaco,
                                    q.id,
                                    handleRunQuery,
                                  );
                                }}
                                tableSchemas={tableSchemas}
                                tableSamples={tableSamples}
                                getLatestSchemas={() => {
                                  // If tableSchemas is empty, try to fetch tables
                                  if (Object.keys(tableSchemas).length === 0) {
                                    // We can't await here, but we can trigger the fetch
                                    // This will update the state for next time
                                    void fetchTables();
                                  }
                                  return {tableSchemas, tableSamples};
                                }}
                              />
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                  defaultSize={50}
                  className="overflow-hidden bg-muted text-sm"
                >
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
                    <div className="flex-grow overflow-hidden flex flex-col relative w-full h-full">
                      <DataTableVirtualized {...resultsTableData} />
                      <div className="absolute bottom-0 right-0 flex gap-2">
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
                          onClick={exportResults}
                        >
                          <DownloadIcon className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            {showDocs && (
              <>
                <ResizableHandle withHandle />
                {/* Documentation panel - 30% width */}
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
          onAddOrUpdateSqlQuery={addOrUpdateSqlQuery}
        />
        <DeleteSqlQueryModal
          isOpen={queryToDelete !== null}
          onClose={() => setQueryToDelete(null)}
          onConfirm={handleConfirmDeleteQuery}
        />
        <RenameSqlQueryModal
          isOpen={queryToRename !== null}
          onClose={() => setQueryToRename(null)}
          initialName={queryToRename?.name ?? ''}
          onRename={handleFinishRename}
        />
      </div>
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
const SqlEditor = React.memo(SqlEditorBase);

export default SqlEditor;
