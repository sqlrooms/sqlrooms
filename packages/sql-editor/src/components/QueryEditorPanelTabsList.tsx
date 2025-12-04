import {TabStrip} from '@sqlrooms/ui';
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

  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);
  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
      const trimmed = newName.trim();
      if (trimmed !== '') {
        renameQueryTab(queryId, trimmed);
      }
    },
    [renameQueryTab],
  );

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
  }, [createQueryTab]);

  const handleConfirmDeleteQuery = useCallback(() => {
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
        onCloseTab={(tab) => closeQueryTab(tab.id)}
        onOpenTab={(tab) => openQueryTab(tab.id)}
        onCreateTab={handleNewQuery}
        onRenameTab={(tab, newName) => handleRename(tab.id, newName)}
        onRequestRename={(tab) => handleStartRename(tab.id, tab.name)}
        onDeleteTab={(tab) => handleDeleteQuery(tab.id)}
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
    </>
  );
};
