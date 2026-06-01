import {cn} from '@sqlrooms/ui';
import {useCallback, useMemo} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {SqlCodeMirrorEditor} from '../SqlCodeMirrorEditor';

const CODEMIRROR_OPTIONS = {
  lineWrapping: true,
  autocompletion: true,
  highlightActiveLine: true,
};

/**
 * @deprecated Prefer `SqlQuery.Editor` for newly composed single-query
 * surfaces. This component remains for compatibility with the legacy tabbed
 * query panel.
 */
export const QueryEditorPanelEditor: React.FC<{
  className?: string;
  queryId: string;
  readOnly?: boolean;
  autoHeight?: boolean;
  compact?: boolean;
}> = ({className, queryId, readOnly, autoHeight, compact}) => {
  const tableSchemas = useStoreWithSqlEditor((s) => s.db.tables);
  const runQueryById = useStoreWithSqlEditor((s) => s.sqlEditor.runQueryById);
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
      updateQueryText(queryId, value ?? '');
    },
    [queryId, updateQueryText],
  );

  // Handle query execution via keyboard shortcut
  const handleRunQuery = useCallback(
    (query: string) => {
      runQueryById(queryId, query);
    },
    [queryId, runQueryById],
  );

  const editorOptions = useMemo(
    () => ({
      ...CODEMIRROR_OPTIONS,
      lineNumbers: compact ? false : undefined,
      foldGutter: compact ? false : undefined,
      highlightActiveLine: compact ? false : undefined,
    }),
    [compact],
  );

  return (
    <SqlCodeMirrorEditor
      key={queryId}
      connector={connector}
      value={queryText ?? ''}
      onChange={handleUpdateQuery}
      className={cn(
        autoHeight
          ? [
              'h-auto min-h-0 w-full grow',
              '[&_.cm-content]:min-h-12',
              '[&_.cm-editor]:h-auto [&_.cm-editor]:min-h-12',
              '[&_.cm-scroller]:overflow-visible',
            ]
          : 'h-full w-full grow',
        className,
      )}
      options={editorOptions}
      onRunQuery={handleRunQuery}
      tableSchemas={tableSchemas}
      readOnly={readOnly}
      hideGutter={compact}
    />
  );
};
