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
  const openTabIds = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.openTabIds,
  );
  const selectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.selectedQueryId,
  );

  const renameQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.renameQueryTab,
  );
  const closeQueryTab = useStoreWithSqlEditor((s) => s.sqlEditor.closeQueryTab);
  const openQueryTab = useStoreWithSqlEditor((s) => s.sqlEditor.openQueryTab);
  const setSelectedQueryId = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setSelectedQueryId,
  );
  const createQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.createQueryTab,
  );
  const deleteQueryTab = useStoreWithSqlEditor(
    (s) => s.sqlEditor.deleteQueryTab,
  );
  const reorderQueryTabs = useStoreWithSqlEditor(
    (s) => s.sqlEditor.reorderQueryTabs,
  );

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
        openTabIds={openTabIds}
        selectedTabId={selectedQueryId}
        onClose={closeQueryTab}
        onOpen={openQueryTab}
        onSelect={setSelectedQueryId}
        onCreate={createQueryTab}
        onRename={renameQueryTab}
        onReorder={reorderQueryTabs}
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
