import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {MonacoEditor} from '@sqlrooms/monaco-editor';
import type {MonacoEditorProps} from '@sqlrooms/monaco-editor';
import type {OnMount} from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  DUCKDB_KEYWORDS,
  DUCKDB_FUNCTIONS,
  SQL_LANGUAGE_CONFIGURATION,
} from './constants/duckdb-dialect';
import type {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {cn} from '@sqlrooms/ui';
import {getFunctionSuggestions} from './constants/functionSuggestions';
export interface SqlMonacoEditorProps extends Omit<
  MonacoEditorProps,
  'language'
> {
  connector?: DuckDbConnector;
  /**
   * Custom SQL keywords to add to the completion provider.
   *
   * Note: syntax highlighting is global and uses the built-in DuckDB dialect
   * (`DUCKDB_KEYWORDS` / `DUCKDB_FUNCTIONS`) to avoid per-editor global reconfiguration
   * (which can cause flashing). These are currently **completion-only**.
   */
  customKeywords?: string[];
  /**
   * Custom SQL functions to add to the completion provider.
   *
   * Note: syntax highlighting is global and uses the built-in DuckDB dialect
   * (`DUCKDB_KEYWORDS` / `DUCKDB_FUNCTIONS`) to avoid per-editor global reconfiguration
   * (which can cause flashing). These are currently **completion-only**.
   */
  customFunctions?: string[];
  /**
   * Table schemas for autocompletion
   */
  tableSchemas?: DataTable[];
  /**
   * Callback to get the latest table schemas
   * This is called from within provideCompletionItems to ensure we have the latest data
   */
  getLatestSchemas?: () => {
    tableSchemas: DataTable[];
  };
}

const EDITOR_OPTIONS: MonacoEditorProps['options'] = {
  formatOnPaste: true,
  formatOnType: true,
  wordWrap: 'on',
};

type MonacoInstance = typeof Monaco;

type SqlCompletionContext = {
  connector?: DuckDbConnector;
  tableSchemas: DataTable[];
  getLatestSchemas?: () => {tableSchemas: DataTable[]};
  customKeywords: string[];
  customFunctions: string[];
};

// Singleton guards to prevent re-registration on every editor mount (causes flashing)
let sqlLanguageConfigured = false;
let sqlCompletionProviderDisposable: Monaco.IDisposable | null = null;
// Per-model context store so multiple SqlMonacoEditor instances don't clobber each other.
// WeakMap is used so entries can be GC'd in long-lived apps.
const sqlCompletionContextByModel = new WeakMap<object, SqlCompletionContext>();

function ensureSqlLanguageConfigured(monaco: MonacoInstance) {
  if (sqlLanguageConfigured) return;
  sqlLanguageConfigured = true;

  if (!monaco.languages.getLanguages().some((lang: any) => lang.id === 'sql')) {
    monaco.languages.register({id: 'sql'});
  }

  // Tokenization is GLOBAL. Keep it stable for DuckDB to avoid global re-tokenization
  // when multiple SqlMonacoEditors exist (tabs/modals) which can cause flashing.
  monaco.languages.setMonarchTokensProvider('sql', {
    ...SQL_LANGUAGE_CONFIGURATION,
    keywords: DUCKDB_KEYWORDS,
    builtinFunctions: DUCKDB_FUNCTIONS,
  } as any);
}

function ensureSqlCompletionProvider(monaco: MonacoInstance) {
  if (sqlCompletionProviderDisposable) return;

  sqlCompletionProviderDisposable =
    monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', ',', '(', '='],
      provideCompletionItems: async (model: any, position: any) => {
        try {
          const ctx = sqlCompletionContextByModel.get(model) ?? {
            connector: undefined,
            tableSchemas: [],
            getLatestSchemas: undefined,
            customKeywords: [],
            customFunctions: [],
          };

          // Get the latest schemas if the callback is provided
          let currentSchemas = ctx.tableSchemas;
          if (ctx.getLatestSchemas) {
            const latest = ctx.getLatestSchemas();
            currentSchemas = latest.tableSchemas;
          }

          const suggestions: Monaco.languages.CompletionItem[] = [];
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // Get the text before the cursor to determine context
          const lineContent = model.getLineContent(position.lineNumber);
          const textBeforeCursor = lineContent
            .substring(0, position.column - 1)
            .trim()
            .toLowerCase();

          // Check if we're after a FROM, JOIN, or similar clause to prioritize table suggestions
          const isTableContext = /\b(from|join|into|update|table)\s+\w*$/.test(
            textBeforeCursor,
          );

          // Check if we're after a table name and period to prioritize column suggestions
          const isColumnContext = /\b(\w+)\.\w*$/.test(textBeforeCursor);

          // Combine keywords and functions with custom ones
          const keywords = [...DUCKDB_KEYWORDS, ...ctx.customKeywords];
          const functions = [...DUCKDB_FUNCTIONS, ...ctx.customFunctions];

          // Add keyword suggestions (if not in a specific context)
          if (!isColumnContext) {
            keywords.forEach((keyword) => {
              suggestions.push({
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range: range,
                detail: 'Keyword',
                sortText: isTableContext ? 'z' + keyword : 'a' + keyword, // Lower priority in table context
              });
            });
          }

          // Add function suggestions (if not in a specific context)
          if (!isColumnContext) {
            functions.forEach((func) => {
              suggestions.push({
                label: func,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: func,
                range: range,
                detail: 'Function',
                sortText: isTableContext ? 'z' + func : 'b' + func, // Lower priority in table context
              });
            });
            if (ctx.connector) {
              const functionSuggestions = await getFunctionSuggestions(
                ctx.connector,
                word.word,
              );
              for (const {name, documentation} of functionSuggestions) {
                suggestions.push({
                  label: name,
                  insertText: name,
                  documentation: {
                    value: documentation,
                    isTrusted: true,
                    supportHtml: true,
                  },
                  range: range,
                  kind: monaco.languages.CompletionItemKind.Function,
                  sortText: isTableContext ? 'z' + name : 'b' + name, // Lower priority in table context
                });
              }
            }
          }

          // Add table and column suggestions from schemas
          currentSchemas.forEach((table) => {
            const tableName = table.tableName;

            // Add table suggestion
            suggestions.push({
              label: tableName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: tableName,
              range: range,
              detail: 'Table',
              documentation: {
                value: `Table: ${tableName}`,
                isTrusted: true,
              },
              sortText: isTableContext ? 'a' + tableName : 'c' + tableName, // Higher priority in table context
            });

            // Extract table name from context if we're in a column context
            let contextTableName = '';
            if (isColumnContext) {
              const match = textBeforeCursor.match(/\b(\w+)\.\w*$/);
              if (match && match[1]) {
                contextTableName = match[1];
              }
            }

            // Only add columns for the current table if we're in a column context
            if (!isColumnContext || contextTableName === tableName) {
              // Add column suggestions
              table.columns.forEach((column) => {
                const columnName = column.name;
                const columnType = column.type;

                suggestions.push({
                  label: columnName,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: columnName,
                  range: range,
                  detail: `Column (${columnType})`,
                  documentation: {
                    value: `Column from table ${tableName}`,
                    isTrusted: true,
                  },
                  sortText:
                    isColumnContext && contextTableName === tableName
                      ? 'a' + columnName
                      : 'd' + columnName,
                });

                // Only add table.column suggestions if not in a column context
                if (!isColumnContext) {
                  suggestions.push({
                    label: `${tableName}.${columnName}`,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: `${tableName}.${columnName}`,
                    range: range,
                    detail: `Column (${columnType})`,
                    documentation: {
                      value: `Column from table ${tableName}`,
                      isTrusted: true,
                    },
                    sortText: 'e' + tableName + columnName,
                  });
                }
              });
            }
          });

          return {suggestions};
        } catch (error) {
          console.error('Error in SQL completion provider:', error);
          return {suggestions: []};
        }
      },
    });
}

/**
 * A Monaco editor for editing SQL with DuckDB syntax highlighting and autocompletion
 * This is an internal component used by SqlEditor
 */
export const SqlMonacoEditor: React.FC<SqlMonacoEditorProps> = ({
  connector,
  customKeywords = [],
  customFunctions = [],
  tableSchemas = [],
  getLatestSchemas,
  onMount,
  className,
  options,
  ...restProps
}) => {
  const modelRef = useRef<any>(null);

  // Update per-model context when props change
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    sqlCompletionContextByModel.set(model, {
      connector,
      tableSchemas,
      getLatestSchemas,
      customKeywords,
      customFunctions,
    });
  }, [
    connector,
    tableSchemas,
    getLatestSchemas,
    customKeywords,
    customFunctions,
  ]);

  // Backstop cleanup: if the React component unmounts before Monaco disposes the model,
  // ensure we don't hold on to context longer than necessary.
  useEffect(() => {
    return () => {
      const model = modelRef.current;
      if (model) sqlCompletionContextByModel.delete(model);
    };
  }, []);

  // Handle editor mounting to configure SQL language features
  const handleEditorDidMount = useCallback<OnMount>(
    (editor, monaco) => {
      ensureSqlLanguageConfigured(monaco);
      ensureSqlCompletionProvider(monaco);

      const model = editor.getModel?.();
      if (model) {
        modelRef.current = model;
        sqlCompletionContextByModel.set(model, {
          connector,
          tableSchemas,
          getLatestSchemas,
          customKeywords,
          customFunctions,
        });
      }

      // Cleanup on dispose
      if (model) {
        editor.onDidDispose(() => {
          sqlCompletionContextByModel.delete(model);
        });
      }

      // Call the original onMount if provided
      if (onMount) {
        onMount(editor, monaco);
      }
    },
    [
      connector,
      customKeywords,
      customFunctions,
      getLatestSchemas,
      onMount,
      tableSchemas,
    ],
  );

  const combinedOptions = useMemo(
    (): MonacoEditorProps['options'] => ({
      ...EDITOR_OPTIONS,
      ...options,
    }),
    [options],
  );
  return (
    <MonacoEditor
      language="sql"
      onMount={handleEditorDidMount}
      className={cn('h-full', className)}
      options={combinedOptions}
      {...restProps}
    />
  );
};
