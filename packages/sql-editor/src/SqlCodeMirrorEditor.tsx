import React, {useCallback, useMemo, useRef} from 'react';
import type {EditorView} from '@codemirror/view';
import type {Extension} from '@codemirror/state';
import type {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {CodeMirrorEditor, CodeMirrorEditorProps} from '@sqlrooms/codemirror';
import {
  createSqlExtension,
  SqlDialects,
  type SqlDialect,
} from './codemirror/extensions/create-sql-extension';
import {createSqlKeymap} from './codemirror/extensions/sql-keymap';
import {createSqlTheme} from './codemirror/themes/sql-theme';

export interface SqlCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'extensions'
> {
  /** SQL dialect for syntax highlighting and completions */
  dialect?: SqlDialect;
  /**
   * Connector for dynamic function suggestions
   * TODO: change to generic connector interface to support multiple dialects
   */
  connector?: DuckDbConnector;
  /** Table schemas for autocompletion and hover tooltips */
  tableSchemas?: DataTable[];
  /** Callback to get the latest table schemas */
  getLatestSchemas?: () => {tableSchemas: DataTable[]};
  /** Callback when Cmd+Enter is pressed (selected text or full document) */
  onRunQuery?: (query: string) => void;
}

const EDITOR_OPTIONS: CodeMirrorEditorProps['options'] = {
  lineNumbers: true,
  lineWrapping: true,
  highlightActiveLine: true,
  autocompletion: true,
};

/**
 * CodeMirror editor for SQL with dialect-specific support
 *
 * Lightweight alternative to SqlMonacoEditor with syntax highlighting,
 * linting, schema-aware completions, and hover tooltips. Cmd+Enter to run query.
 */
export const SqlCodeMirrorEditor: React.FC<SqlCodeMirrorEditorProps> = ({
  dialect = SqlDialects.DuckDb,
  connector,
  tableSchemas = [],
  getLatestSchemas,
  onRunQuery,
  onMount,
  options,
  ...restProps
}) => {
  const viewRef = useRef<EditorView | null>(null);

  // Get current schemas (use callback if provided)
  const currentSchemas = useMemo(() => {
    if (getLatestSchemas) {
      return getLatestSchemas().tableSchemas;
    }
    return tableSchemas;
  }, [getLatestSchemas, tableSchemas]);

  // Build extensions
  const extensions = useMemo<Extension[]>(() => {
    return [
      ...createSqlExtension({
        dialect,
        currentSchemas,
        connector,
      }),
      createSqlKeymap(onRunQuery),
      createSqlTheme(),
    ];
  }, [dialect, currentSchemas, onRunQuery, connector]);

  // Handle editor mount
  const handleEditorMount = useCallback(
    (view: EditorView) => {
      viewRef.current = view;

      // Call user onMount if provided
      if (onMount) {
        onMount(view);
      }
    },
    [onMount],
  );

  const combinedOptions = useMemo(
    (): CodeMirrorEditorProps['options'] => ({
      ...EDITOR_OPTIONS,
      ...options,
    }),
    [options],
  );

  return (
    <CodeMirrorEditor
      onMount={handleEditorMount}
      extensions={extensions}
      options={combinedOptions}
      {...restProps}
    />
  );
};
