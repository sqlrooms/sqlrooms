import React, {useCallback} from 'react';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {MoreVerticalIcon, PlayIcon, PlusIcon} from 'lucide-react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {SqlMonacoEditor} from '../SqlMonacoEditor';
import type * as Monaco from 'monaco-editor';

export interface QueryEditorPanelProps {
  /** Custom class name for styling */
  className?: string;
  /** The database schema to use. Defaults to 'main' */
  schema?: string;
  /** Callback when a query is executed */
  onQueryExecute?: (query: string) => void;
}

type EditorInstance = Monaco.editor.IStandaloneCodeEditor;
type MonacoInstance = typeof Monaco;

const DEFAULT_QUERY = '';

export const QueryEditorPanel: React.FC<QueryEditorPanelProps> = ({
  className,
  schema = 'main',
  onQueryExecute,
}) => {
  // Get state from store
  const queries = useStoreWithSqlEditor((s) => s.config.sqlEditor.queries);
  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.config.sqlEditor.selectedQueryId,
  );
  const tableSchemas = useStoreWithSqlEditor((s) => s.db.tables);
  const currentQuery = useStoreWithSqlEditor((s) =>
    s.sqlEditor.getCurrentQuery(DEFAULT_QUERY),
  );

  // Get methods from store
  const runQuery = useStoreWithSqlEditor((s) => s.sqlEditor.runQuery);
  const createQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.createQueryTab,
  );
  const deleteQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.deleteQueryTab,
  );
  const renameQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.renameQueryTab,
  );
  const updateQueryText = useStoreWithSqlEditor(
    (s) => s.sqlEditor.updateQueryText,
  );
  const setSelectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setSelectedQueryId,
  );

  // Local state for modals
  const [queryToDelete, setQueryToDelete] = React.useState<string | null>(null);
  const [queryToRename, setQueryToRename] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // Editor instance ref for keyboard shortcuts
  const editorRef = React.useRef<{
    [key: string]: EditorInstance;
  }>({});

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setSelectedQueryId(value);
    },
    [setSelectedQueryId],
  );

  // Handle query text update
  const handleUpdateQuery = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      updateQueryText(selectedQueryId, value);
    },
    [selectedQueryId, updateQueryText],
  );

  // Handle new query creation
  const handleNewQuery = useCallback(() => {
    return createQueryTab(DEFAULT_QUERY);
  }, [createQueryTab]);

  // Handle query execution
  const handleRunQuery = useCallback(async () => {
    const queryToRun = currentQuery;
    await runQuery(queryToRun, schema);
    onQueryExecute?.(queryToRun);
  }, [currentQuery, runQuery, schema, onQueryExecute]);

  // Handle editor mount
  const handleEditorMount = useCallback(
    (editor: EditorInstance, monaco: MonacoInstance, queryId: string) => {
      editorRef.current[queryId] = editor;

      // Add keyboard shortcut for running query
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void handleRunQuery();
      });
    },
    [handleRunQuery],
  );

  // Handle rename query
  const handleStartRename = useCallback(
    (queryId: string, currentName: string, event: React.MouseEvent) => {
      event.preventDefault();
      setQueryToRename({id: queryId, name: currentName});
    },
    [],
  );

  const handleFinishRename = useCallback(
    (newName: string) => {
      if (queryToRename) {
        renameQueryTab(queryToRename.id, newName);
      }
      setQueryToRename(null);
    },
    [queryToRename, renameQueryTab],
  );

  // Handle delete query
  const handleDeleteQuery = useCallback(
    (queryId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setQueryToDelete(queryId);
    },
    [],
  );

  const handleConfirmDeleteQuery = useCallback(() => {
    if (queryToDelete) {
      deleteQueryTab(queryToDelete);
      setQueryToDelete(null);
    }
  }, [queryToDelete, deleteQueryTab]);

  return (
    <Tabs
      value={selectedQueryId}
      onValueChange={handleTabChange}
      className={cn('flex h-full flex-col overflow-hidden', className)}
    >
      <div className="border-border flex items-center gap-2 border-b">
        <Button
          size="sm"
          onClick={() => void handleRunQuery()}
          className="uppercase"
        >
          <PlayIcon className="mr-2 h-4 w-4" />
          Run
        </Button>
        <TabsList className="flex-1">
          {queries.map((q) => (
            <div key={q.id} className="relative">
              <TabsTrigger value={q.id} className="min-w-[60px] px-6 pr-8">
                {q.name}
              </TabsTrigger>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    className="hover:bg-accent absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm"
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
      {queries.map((q) => (
        <TabsContent
          key={q.id}
          value={q.id}
          className="relative h-full flex-grow flex-col data-[state=active]:flex"
        >
          <div className="absolute inset-0 h-full w-full flex-grow">
            <SqlMonacoEditor
              value={q.query}
              onChange={handleUpdateQuery}
              className="h-full w-full flex-grow"
              options={{
                scrollBeyondLastLine: false,
                automaticLayout: true,
                minimap: {enabled: false},
                wordWrap: 'on',
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
              }}
              onMount={(editor: EditorInstance, monaco: MonacoInstance) => {
                handleEditorMount(editor, monaco, q.id);
              }}
              tableSchemas={tableSchemas}
              getLatestSchemas={() => ({tableSchemas})}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
};
