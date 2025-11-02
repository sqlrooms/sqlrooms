import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EditableText,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {MoreVerticalIcon, PlusIcon} from 'lucide-react';
import React, {useCallback} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';

export const QueryEditorPanelTabsList: React.FC<{className?: string}> = ({
  className,
}) => {
  const queries = useStoreWithSqlEditor((s) => s.sqlEditor.config.queries);

  const renameQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.renameQueryTab,
  );

  // Local state for modals and editing
  const [queryToDelete, setQueryToDelete] = React.useState<string | null>(null);
  const [editingQueryId, setEditingQueryId] = React.useState<string | null>(
    null,
  );
  const [queryToRename, setQueryToRename] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const createQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.createQueryTab,
  );
  const deleteQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.deleteQueryTab,
  );

  // Handle rename query
  const handleStartRename = useCallback(
    (queryId: string, currentName: string) => {
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
  // Handle rename query
  const handleRename = useCallback(
    (queryId: string, newName: string) => {
      if (newName.trim() !== '') {
        renameQueryTab(queryId, newName.trim());
      }
      setEditingQueryId(null);
    },
    [renameQueryTab],
  );

  // Handle double click to start editing
  const handleDoubleClick = useCallback((queryId: string) => {
    setEditingQueryId(queryId);
  }, []);

  // Handle delete query
  const handleDeleteQuery = useCallback(
    (queryId: string) => {
      // Find the query to check if it's empty
      const queryToDelete = queries.find((q) => q.id === queryId);

      // If query is empty (no content), delete immediately without confirmation
      if (queryToDelete && queryToDelete.query.trim() === '') {
        deleteQueryTab(queryId);
      } else {
        // Otherwise, show confirmation modal
        setQueryToDelete(queryId);
      }
    },
    [queries, deleteQueryTab],
  );

  // Handle new query creation
  const handleNewQuery = useCallback(() => {
    return createQueryTab();
  }, [createQueryTab]);

  const handleConfirmDeleteQuery = useCallback(() => {
    if (queryToDelete) {
      deleteQueryTab(queryToDelete);
      setQueryToDelete(null);
    }
  }, [queryToDelete, deleteQueryTab]);

  return (
    <>
      <TabsList className={cn('h-auto flex-1 flex-wrap', className)}>
        {queries.map((q) => (
          <div key={q.id} className="relative">
            <TabsTrigger
              value={q.id}
              className="hover:bg-accent min-w-[60px] max-w-[150px] overflow-hidden px-6 py-0 pr-8"
            >
              <div
                className="flex h-6 items-center"
                onDoubleClick={() => handleDoubleClick(q.id)}
              >
                {editingQueryId !== q.id ? (
                  <div>{q.name}</div>
                ) : (
                  <EditableText
                    value={q.name}
                    onChange={(newName: string) => handleRename(q.id, newName)}
                    className="h-6 truncate text-sm"
                    isEditing={editingQueryId === q.id}
                    onEditingChange={(isEditing) => {
                      if (!isEditing) {
                        setEditingQueryId(null);
                      }
                    }}
                  />
                )}
              </div>
            </TabsTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="hover:bg-accent absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm">
                  <MoreVerticalIcon className="h-3 w-3" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    handleStartRename(q.id, q.name);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                {queries.length > 1 && (
                  <DropdownMenuItem
                    onClick={() => {
                      handleDeleteQuery(q.id);
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
