import {cn} from '@sqlrooms/ui';
import {useCallback} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {SqlMonacoEditor, SqlMonacoRunQueryOptions} from '../SqlMonacoEditor';

const MONACO_OPTIONS = {
  scrollBeyondLastLine: false,
  automaticLayout: true,
  minimap: {enabled: false},
  wordWrap: 'on' as const,
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
};

export const QueryEditorPanelEditor: React.FC<{
  className?: string;
  queryId: string;
}> = ({className, queryId}) => {
  const tableSchemas = useStoreWithSqlEditor((s) => s.db.tables);
  const runQuery = useStoreWithSqlEditor((s) => s.sqlEditor.parseAndRunQuery);
  const connector = useStoreWithSqlEditor((s) => s.db.connector);

  const queryText = useStoreWithSqlEditor(
    (s) => s.sqlEditor.config.queries.find((q) => q.id === queryId)?.query,
  );
  const updateQueryText = useStoreWithSqlEditor(
    (s) => s.sqlEditor.updateQueryText,
  );

  // Handle query text update
  const handleUpdateQuery = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      updateQueryText(queryId, value);
    },
    [queryId, updateQueryText],
  );

  // Handle query execution via keyboard shortcut
  const handleRunQuery = useCallback(
    ({value, selectedValue, isSelectionEmpty}: SqlMonacoRunQueryOptions) => {
      if (!isSelectionEmpty) {
        runQuery(selectedValue);
      } else {
        runQuery(value ?? '');
      }
    },
    [runQuery],
  );

  return (
    <SqlMonacoEditor
      connector={connector}
      value={queryText ?? ''}
      onChange={handleUpdateQuery}
      className={cn('h-full w-full grow', className)}
      options={MONACO_OPTIONS}
      onRunQuery={handleRunQuery}
      tableSchemas={tableSchemas}
    />
  );
};
