import React, {useCallback, useMemo, useRef} from 'react';
import type {EditorView} from '@codemirror/view';
import type {Extension} from '@codemirror/state';
import type {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {createSqlKeymap} from '../extensions/sql-keymap';
import {CodeMirrorEditor, CodeMirrorEditorProps} from './CodeMirrorEditor';
import {createSqlTheme} from '../themes/sql-theme';
import {Theme, useIsDarkTheme} from '@sqlrooms/ui';
import {createDuckDbExtension} from '../extensions/duck-db';

export interface DuckdbCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'extensions'
> {
  /** DuckDB connector for dynamic function suggestions */
  connector?: DuckDbConnector;
  /** Custom SQL keywords (completion-only, not syntax highlighting) */
  customKeywords?: string[];
  /** Custom SQL functions (completion-only, not syntax highlighting) */
  customFunctions?: string[];
  /** Table schemas for autocompletion and hover tooltips */
  tableSchemas?: DataTable[];
  /** Callback to get the latest table schemas */
  getLatestSchemas?: () => {tableSchemas: DataTable[]};
  /** Callback when Cmd+Enter is pressed (selected text or full document) */
  onRunQuery?: (query: string) => void;
  /** Optional theme override (defaults to auto-detect) */
  theme?: Theme;
}

const EDITOR_OPTIONS: CodeMirrorEditorProps['options'] = {
  lineNumbers: true,
  lineWrapping: true,
  highlightActiveLine: true,
  autocompletion: true,
};

/**
 * CodeMirror editor for SQL with DuckDB dialect support
 *
 * Lightweight alternative to SqlMonacoEditor with syntax highlighting,
 * linting, schema-aware completions, and hover tooltips. Cmd+Enter to run query.
 */
export const DuckdbCodeMirrorEditor: React.FC<DuckdbCodeMirrorEditorProps> = ({
  connector,
  customKeywords = [],
  customFunctions = [],
  tableSchemas = [],
  getLatestSchemas,
  onRunQuery,
  onMount,
  options,
  theme,
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

  const isDark = useIsDarkTheme(theme);

  // Build extensions
  const extensions = useMemo<Extension[]>(() => {
    return [
      ...createDuckDbExtension({
        currentSchemas,
        connector,
        customKeywords,
        customFunctions,
      }),
      createSqlKeymap(onRunQuery),
      createSqlTheme({isDark}),
    ];
  }, [
    isDark,
    currentSchemas,
    onRunQuery,
    connector,
    customKeywords,
    customFunctions,
  ]);

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
