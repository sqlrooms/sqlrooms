import {TabStrip} from '@sqlrooms/ui';
import {PencilIcon, TrashIcon} from 'lucide-react';
import React, {useCallback, useState} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import DeleteSqlQueryModal from './DeleteSqlQueryModal';
import RenameSqlQueryModal from './RenameSqlQueryModal';

export const QueryEditorPanelTabsList: React.FC<{className?: string}> = ({
  className,
}) => {
  const queries = useStoreWithSqlEditor((s) => s.sqlEditor.config.queries);
  const openTabs = useStoreWithSqlEditor((s) => s.sqlEditor.config.openTabs);
  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.selectedQueryId,
  );

  const renameQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.renameQueryTab,
  );
  const closeQueryTab = useStoreWithSqlEditor((s) => s.sqlEditor.closeQueryTab);
  const setSelectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setSelectedQueryId,
  );
  const createQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.createQueryTab,
  );
  const deleteQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.deleteQueryTab,
  );
  const setOpenTabs = useStoreWithSqlEditor((s) => s.sqlEditor.setOpenTabs);

  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);
  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleRenameRequest = useCallback(
    (queryId: string) => {
      const query = queries.find((q) => q.id === queryId);
      if (query) {
        setQueryToRename({id: queryId, name: query.name});
      }
    },
    [queries],
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

  const handleDelete = useCallback(
    (queryId: string) => {
      const query = queries.find((q) => q.id === queryId);
      // If query is empty (no content), delete immediately without confirmation
      if (query && query.query.trim() === '') {
        deleteQueryTab(queryId);
      } else {
        // Otherwise, show confirmation modal
        setQueryToDelete(queryId);
      }
    },
    [queries, deleteQueryTab],
  );

  const handleConfirmDelete = useCallback(() => {
    if (queryToDelete) {
      deleteQueryTab(queryToDelete);
      setQueryToDelete(null);
    }
  }, [queryToDelete, deleteQueryTab]);

  return (
    <>
      <TabStrip
        className={className}
        tabs={queries}
        openTabs={openTabs}
        selectedTabId={selectedQueryId}
        onClose={closeQueryTab}
        onOpenTabsChange={setOpenTabs}
        onSelect={setSelectedQueryId}
        onCreate={createQueryTab}
        onRename={renameQueryTab}
        renderTabMenu={(tab) => (
          <>
            <TabStrip.MenuItem onClick={() => handleRenameRequest(tab.id)}>
              <PencilIcon className="mr-2 h-4 w-4" />
              Rename
            </TabStrip.MenuItem>
            <TabStrip.MenuSeparator />
            <TabStrip.MenuItem
              variant="destructive"
              onClick={() => handleDelete(tab.id)}
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete
            </TabStrip.MenuItem>
          </>
        )}
        renderSearchItemActions={(tab) => (
          <>
            <TabStrip.SearchItemAction
              icon={<PencilIcon className="h-3 w-3" size={5} />}
              aria-label={`Rename ${tab.name}`}
              onClick={() => handleRenameRequest(tab.id)}
            />
            <TabStrip.SearchItemAction
              icon={<TrashIcon className="h-3 w-3" />}
              aria-label={`Delete ${tab.name}`}
              onClick={() => handleDelete(tab.id)}
            />
          </>
        )}
      />

      <DeleteSqlQueryModal
        isOpen={queryToDelete !== null}
        onClose={() => setQueryToDelete(null)}
        onConfirm={handleConfirmDelete}
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
