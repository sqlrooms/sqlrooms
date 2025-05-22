import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  const queries = useStoreWithSqlEditor((s) => s.config.sqlEditor.queries);

  const renameQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.renameQueryTab,
  );

  // Local state for modals
  const [queryToDelete, setQueryToDelete] = React.useState<string | null>(null);
  const [queryToRename, setQueryToRename] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
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

  // Handle delete query
  const handleDeleteQuery = useCallback((queryId: string) => {
    setQueryToDelete(queryId);
  }, []);
  const createQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.createQueryTab,
  );
  const deleteQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.deleteQueryTab,
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
