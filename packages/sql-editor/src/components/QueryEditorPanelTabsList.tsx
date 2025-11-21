import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EditableText,
  Input,
  TabsList,
  TabsTrigger,
} from '@sqlrooms/ui';
import {ListCollapseIcon, PlusIcon, XIcon, SearchIcon} from 'lucide-react';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import {QueryTabMenuItem} from './QueryTabMenuItem';
import RenameSqlQueryModal from './RenameSqlQueryModal';

export const QueryEditorPanelTabsList: React.FC<{className?: string}> = ({
  className,
}) => {
  const queries = useStoreWithSqlEditor((s) => s.sqlEditor.config.queries);
  const closedTabIds = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.closedTabIds,
  );
  const openedTabs = queries.filter((q) => !closedTabIds.includes(q.id));
  const closedTabs = queries.filter((q) => closedTabIds.includes(q.id));

  const renameQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.renameQueryTab,
  );

  // Local state for modals and editing
  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);
  const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const closeQueryTab = useStoreWithSqlEditor((s) => s.sqlEditor.closeQueryTab);
  const openQueryTab = useStoreWithSqlEditor((s) => s.sqlEditor.openQueryTab);
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

  const filteredClosedTabs = useMemo(() => {
    if (!searchQuery.trim()) return closedTabs;
    const lowerQuery = searchQuery.toLowerCase();
    return closedTabs.filter((tab) =>
      tab.name.toLowerCase().includes(lowerQuery),
    );
  }, [closedTabs, searchQuery]);

  const filteredOpenedTabs = useMemo(() => {
    if (!searchQuery.trim()) return openedTabs;
    const lowerQuery = searchQuery.toLowerCase();
    return openedTabs.filter((tab) =>
      tab.name.toLowerCase().includes(lowerQuery),
    );
  }, [openedTabs, searchQuery]);

  const renderTabGroup = useCallback(
    (tabs: typeof queries, emptyMessage: string) => {
      if (tabs.length === 0) {
        return (
          <DropdownMenuItem
            className="items-center justify-center text-xs"
            disabled
          >
            {emptyMessage}
          </DropdownMenuItem>
        );
      }

      return tabs.map((tab) => (
        <QueryTabMenuItem
          key={tab.id}
          tab={tab}
          onRestore={() => openQueryTab(tab.id)}
          onRename={() => handleStartRename(tab.id, tab.name)}
          onDelete={() => handleDeleteQuery(tab.id)}
        />
      ));
    },
    [openQueryTab, handleStartRename, handleDeleteQuery],
  );

  return (
    <>
      <TabsList
        className={cn(
          'flex min-w-0 justify-start gap-1 bg-transparent p-0 pt-1.5',
          className,
        )}
      >
        <div
          ref={scrollContainerRef}
          className="flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden pr-1 [&::-webkit-scrollbar]:hidden"
        >
          {openedTabs.map((q) => (
            <TabsTrigger
              key={q.id}
              value={q.id}
              className="data-[state=inactive]:hover:bg-primary/5 flex h-full min-w-[100px] max-w-[200px] flex-shrink-0 items-center justify-between gap-2 overflow-hidden rounded-b-none py-0 pl-4 pr-2 font-normal data-[state=active]:shadow-none"
            >
              <div
                className="flex min-w-0 items-center"
                onDoubleClick={() => handleDoubleClick(q.id)}
              >
                {editingQueryId !== q.id ? (
                  <div className="truncate text-sm">{q.name}</div>
                ) : (
                  <EditableText
                    value={q.name}
                    onChange={(newName: string) => handleRename(q.id, newName)}
                    className="h-6 min-w-0 flex-1 truncate text-sm shadow-none"
                    isEditing={editingQueryId === q.id}
                    onEditingChange={(isEditing) => {
                      if (!isEditing) {
                        setEditingQueryId(null);
                      }
                    }}
                  />
                )}
              </div>

              <Button
                size="xs"
                variant="ghost"
                className="hover:bg-primary/10 h-4 w-4 p-1"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  closeQueryTab(q.id);
                }}
              >
                <XIcon size={12} />
              </Button>
            </TabsTrigger>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="ml-2 h-5 w-5 flex-shrink-0"
            >
              <ListCollapseIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="max-h-[400px] max-w-[240px] overflow-y-auto"
          >
            <div className="flex items-center gap-1 px-2">
              <SearchIcon className="text-muted-foreground" size={14} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                className="border-none text-xs shadow-none focus-visible:ring-0"
                placeholder="Search..."
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                Closed
              </DropdownMenuLabel>
              {renderTabGroup(filteredClosedTabs, 'No closed tabs')}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                Opened
              </DropdownMenuLabel>
              {renderTabGroup(filteredOpenedTabs, 'No opened tabs')}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleNewQuery}
          className="h-5 w-5 flex-shrink-0"
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
