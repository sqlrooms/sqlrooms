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
import React, {useCallback, useRef} from 'react';
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

  // Local state for modals and editing
  const [queryToDelete, setQueryToDelete] = React.useState<string | null>(null);
  const [editingQueryId, setEditingQueryId] = React.useState<string | null>(
    null,
  );
  const [queryToRename, setQueryToRename] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    createQueryTab();
    // Auto-scroll to the right after a short delay to ensure the tab is rendered
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          left: scrollContainerRef.current.scrollWidth,
          behavior: 'smooth',
        });
      }
    }, 0);
  }, [createQueryTab]);

  const handleConfirmDeleteQuery = useCallback(() => {
    if (queryToDelete) {
      deleteQueryTab(queryToDelete);
      setQueryToDelete(null);
    }
  }, [queryToDelete, deleteQueryTab]);

  return (
    <>
      <TabsList className={cn('p-0 h-10 flex pt-1.5 gap-1 justify-start bg-transparent', className)}>
        <div ref={scrollContainerRef} className="h-full flex items-center gap-1 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden">
          {queries.map((q) => (
            <TabsTrigger
              key={q.id}
              value={q.id}
              className="h-full flex-shrink-0 min-w-[100px] max-w-[200px] pl-4 pr-2 py-0 font-normal rounded-b-none data-[state=active]:shadow-none overflow-hidden flex items-center justify-between gap-1 data-[state=inactive]:hover:bg-white/40"
            >
              <div
                className="min-w-0 flex items-center"
                onDoubleClick={() => handleDoubleClick(q.id)}
              >
                {editingQueryId !== q.id ? (
                  <div className="truncate text-sm">{q.name}</div>
                ) : (
                  <EditableText
                    value={q.name}
                    onChange={(newName: string) => handleRename(q.id, newName)}
                    className="h-6 shadow-none truncate text-sm flex-1 min-w-0"
                    isEditing={editingQueryId === q.id}
                    onEditingChange={(isEditing) => {
                      if (!isEditing) {
                        setEditingQueryId(null);
                      }
                    }}
                  />
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm" onMouseDown={(e) => e.stopPropagation()}>
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
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsTrigger>
          ))}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleNewQuery}
          className="w-8 h-10 flex-shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </TabsList>
      
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
