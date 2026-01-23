import {cn} from '@sqlrooms/ui';
import type * as Monaco from 'monaco-editor';
import {useCallback, useRef} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {SqlMonacoEditor} from '../SqlMonacoEditor';

type EditorInstance = Monaco.editor.IStandaloneCodeEditor;
type MonacoInstance = typeof Monaco;

const MONACO_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  scrollBeyondLastLine: false,
  automaticLayout: true,
  minimap: {enabled: false},
  wordWrap: 'on',
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
  // Editor instance ref for keyboard shortcuts
  //
  const editorRef = useRef<{
    [key: string]: EditorInstance;
  }>({});

  // Handle query text update
  const handleUpdateQuery = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      updateQueryText(queryId, value);
    },
    [queryId, updateQueryText],
  );

  // Handle editor mount
  const handleEditorMount = useCallback(
    (editor: EditorInstance, monaco: MonacoInstance) => {
      editorRef.current[queryId] = editor;
      // Add keyboard shortcut for running query
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (model && selection && !selection.isEmpty()) {
          runQuery(model.getValueInRange(selection));
        } else {
          runQuery(editor.getValue());
        }
      });
    },
    [queryId, runQuery],
  );

  return (
    <SqlMonacoEditor
      connector={connector}
      value={queryText ?? ''}
      onChange={handleUpdateQuery}
      className={cn('h-full w-full flex-grow', className)}
      options={MONACO_OPTIONS}
      onMount={handleEditorMount}
      tableSchemas={tableSchemas}
    />
  );
};
