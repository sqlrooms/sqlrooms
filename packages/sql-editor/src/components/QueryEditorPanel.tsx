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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {MoreVerticalIcon, PlayIcon, PlusIcon} from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import React, {useCallback} from 'react';
import {isMacOS} from '@sqlrooms/utils';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {SqlMonacoEditor} from '../SqlMonacoEditor';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';

export interface QueryEditorPanelProps {
  /** Custom class name for styling */
  className?: string;
  /** The database schema to use. Defaults to 'main' */
  schema?: string;
}

type EditorInstance = Monaco.editor.IStandaloneCodeEditor;
type MonacoInstance = typeof Monaco;

export const QueryEditorPanel: React.FC<QueryEditorPanelProps> = ({
  className,
}) => {
  // Get state and actions from store in a single call

  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.config.sqlEditor.selectedQueryId,
  );
  const tableSchemas = useStoreWithSqlEditor((s) => s.db.tables);
  const queries = useStoreWithSqlEditor((s) => s.config.sqlEditor.queries);
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
  const runCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.runCurrentQuery,
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

  // Use the function from utils
  const isMac = isMacOS();

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
    return createQueryTab();
  }, [createQueryTab]);

  // Handle editor mount
  const handleEditorMount = useCallback(
    (editor: EditorInstance, monaco: MonacoInstance, queryId: string) => {
      editorRef.current[queryId] = editor;

      // Add keyboard shortcut for running query
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (model && selection && !selection.isEmpty()) {
          runQuery(model.getValueInRange(selection));
        } else {
          runQuery(editor.getValue());
        }
      });
    },
    [runQuery],
  );

  // Handle rename query
  const handleStartRename = useCallback(
    (queryId: string, currentName: string, event: React.MouseEvent) => {
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
    <>
      <Tabs
        value={selectedQueryId}
        onValueChange={setSelectedQueryId}
        className={cn('flex h-full flex-col overflow-hidden', className)}
      >
        <div className="border-border flex items-center border-b p-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="xs"
                onClick={() => runCurrentQuery()}
                className="gap-2"
              >
                <PlayIcon className="h-3 w-3" />
                <span>Run</span>
                <span>{isMac ? '⌘↵' : '⌃↵'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Use {isMac ? 'Cmd' : 'Ctrl'}+Enter to run query or selected text
            </TooltipContent>
          </Tooltip>
          <TabsList className="h-auto flex-1 flex-wrap">
            {queries.map((q) => (
              <div key={q.id} className="relative">
                <TabsTrigger
                  value={q.id}
                  className="hover:bg-accent min-w-[60px] max-w-[150px] overflow-hidden px-6 pr-8"
                >
                  <div className="truncate text-sm">{q.name}</div>
                </TabsTrigger>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <div className="hover:bg-accent absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm">
                      <MoreVerticalIcon className="h-3 w-3" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={(e) => {
                        handleStartRename(q.id, q.name, e);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    {queries.length > 1 && (
                      <DropdownMenuItem
                        onClick={(e) => {
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
    </>
  );
};
