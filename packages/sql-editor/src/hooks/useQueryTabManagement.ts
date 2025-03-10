import {useState, useCallback} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export type SqlQuery = {
  id: string;
  name: string;
  query: string;
};

/**
 * Hook for managing query tabs (adding, renaming, deleting)
 *
 * @deprecated Use the methods directly from SqlEditorSlice instead
 */
export function useQueryTabManagement(defaultQuery: string = '') {
  // Get SQL editor config and functions from the store
  const sqlEditorConfig = useStoreWithSqlEditor((s) => s.config.sqlEditor);
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
  const getCurrentQueryFn = useStoreWithSqlEditor(
    (s) => s.sqlEditor.getCurrentQuery,
  );

  // Local state for modals
  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);
  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

  /**
   * Get the currently selected query's SQL text
   */
  const getCurrentQuery = useCallback(() => {
    return getCurrentQueryFn(defaultQuery);
  }, [getCurrentQueryFn, defaultQuery]);

  /**
   * Change the selected tab
   */
  const handleTabChange = useCallback(
    (value: string) => {
      setSelectedQueryId(value);
    },
    [setSelectedQueryId],
  );

  /**
   * Update a query's SQL text
   */
  const handleUpdateQuery = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      updateQueryText(sqlEditorConfig.selectedQueryId, value);
    },
    [sqlEditorConfig.selectedQueryId, updateQueryText],
  );

  /**
   * Create a new query tab
   */
  const handleNewQuery = useCallback(() => {
    return createQueryTab(defaultQuery);
  }, [createQueryTab, defaultQuery]);

  /**
   * Begin the rename process for a query
   */
  const handleStartRename = useCallback(
    (queryId: string, currentName: string, event: React.MouseEvent) => {
      event.preventDefault();
      setQueryToRename({id: queryId, name: currentName});
    },
    [],
  );

  /**
   * Complete the rename process for a query
   */
  const handleFinishRename = useCallback(
    (newName: string) => {
      if (queryToRename) {
        renameQueryTab(queryToRename.id, newName);
      }
      setQueryToRename(null);
    },
    [queryToRename, renameQueryTab],
  );

  /**
   * Begin the delete process for a query
   */
  const handleDeleteQuery = useCallback(
    (queryId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setQueryToDelete(queryId);
    },
    [],
  );

  /**
   * Confirm and execute the deletion of a query
   */
  const handleConfirmDeleteQuery = useCallback(() => {
    if (queryToDelete) {
      deleteQueryTab(queryToDelete);
      setQueryToDelete(null);
    }
  }, [queryToDelete, deleteQueryTab]);

  return {
    queries: sqlEditorConfig.queries,
    selectedQueryId: sqlEditorConfig.selectedQueryId,
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
  };
}
