import {useState} from 'react';
import {generateUniqueName, genRandomStr} from '@sqlrooms/utils';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export type SqlQuery = {
  id: string;
  name: string;
  query: string;
};

/**
 * Hook for managing query tabs (adding, renaming, deleting)
 */
export function useQueryTabManagement(defaultQuery: string = '') {
  const sqlEditorConfig = useStoreWithSqlEditor(
    (s) => s.project.config.sqlEditor,
  );

  const onChangeSqlEditorConfig = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setSqlEditorConfig,
  );

  const [queryToDelete, setQueryToDelete] = useState<string | null>(null);
  const [queryToRename, setQueryToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);

  /**
   * Get index of a query by its ID
   */
  const getQueryIndexById = (id: string) => {
    return sqlEditorConfig.queries.findIndex((q) => q.id === id);
  };

  /**
   * Get index of the currently selected query
   */
  const getCurrentQueryIndex = () => {
    return getQueryIndexById(sqlEditorConfig.selectedQueryId);
  };

  /**
   * Get the currently selected query's SQL text
   */
  const getCurrentQuery = () => {
    return (
      sqlEditorConfig.queries[getCurrentQueryIndex()]?.query ?? defaultQuery
    );
  };

  /**
   * Change the selected tab
   */
  const handleTabChange = (value: string) => {
    onChangeSqlEditorConfig({
      ...sqlEditorConfig,
      selectedQueryId: value,
    });
  };

  /**
   * Update a query's SQL text
   */
  const handleUpdateQuery = (value: string | undefined) => {
    if (!sqlEditorConfig || !value) return;

    const currentIndex = getCurrentQueryIndex();
    const newQueries = [...sqlEditorConfig.queries];
    if (!newQueries[currentIndex]) return;

    newQueries[currentIndex] = {
      ...newQueries[currentIndex],
      query: value,
    };

    onChangeSqlEditorConfig({
      ...sqlEditorConfig,
      queries: newQueries,
    });
  };

  /**
   * Create a new query tab
   */
  const handleNewQuery = () => {
    const newQueries = [...sqlEditorConfig.queries];
    const newQuery = {
      id: genRandomStr(8),
      name: generateUniqueName(
        'Untitled',
        newQueries.map((q) => q.name),
      ),
      query: defaultQuery,
    };

    newQueries.push(newQuery);

    onChangeSqlEditorConfig({
      ...sqlEditorConfig,
      queries: newQueries,
      selectedQueryId: newQuery.id,
    });

    return newQuery;
  };

  /**
   * Begin the rename process for a query
   */
  const handleStartRename = (
    queryId: string,
    currentName: string,
    event: React.MouseEvent,
  ) => {
    event.preventDefault();
    setQueryToRename({id: queryId, name: currentName});
  };

  /**
   * Complete the rename process for a query
   */
  const handleFinishRename = (newName: string) => {
    if (queryToRename) {
      const newQueries = sqlEditorConfig.queries.map((q) =>
        q.id === queryToRename.id ? {...q, name: newName || q.name} : q,
      );

      onChangeSqlEditorConfig({
        ...sqlEditorConfig,
        queries: newQueries,
      });
    }

    setQueryToRename(null);
  };

  /**
   * Begin the delete process for a query
   */
  const handleDeleteQuery = (queryId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const currentIndex = getQueryIndexById(queryId);
    setQueryToDelete(queryId);

    // Pre-select the previous query if we're deleting the current one
    if (queryId === sqlEditorConfig.selectedQueryId && currentIndex > 0) {
      const prevId = sqlEditorConfig.queries[currentIndex - 1]?.id;
      if (prevId) {
        onChangeSqlEditorConfig({
          ...sqlEditorConfig,
          selectedQueryId: prevId,
        });
      }
    }
  };

  /**
   * Confirm and execute the deletion of a query
   */
  const handleConfirmDeleteQuery = () => {
    if (!queryToDelete) return;

    const newQueries = sqlEditorConfig.queries.filter(
      (q) => q.id !== queryToDelete,
    );

    const deletedIndex = getQueryIndexById(queryToDelete);

    const selectedQueryId =
      newQueries[Math.min(deletedIndex, newQueries.length - 1)]?.id ||
      newQueries[0]?.id;

    if (selectedQueryId) {
      onChangeSqlEditorConfig({
        ...sqlEditorConfig,
        queries: newQueries,
        selectedQueryId,
      });
    }

    setQueryToDelete(null);
  };

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
