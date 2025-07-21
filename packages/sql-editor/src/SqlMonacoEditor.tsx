import React, {useCallback, useEffect, useRef} from 'react';
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
export interface SqlMonacoEditorProps
  extends Omit<MonacoEditorProps, 'language'> {
  connector?: DuckDbConnector;
  /**
   * Custom SQL keywords to add to the completion provider
   */
  customKeywords?: string[];
  /**
   * Custom SQL functions to add to the completion provider
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
  ...props
}) => {
  // Store references to editor and monaco
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const disposableRef = useRef<any>(null);

  // Function to register the completion provider
  const registerCompletionProvider = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const monaco = monacoRef.current;

    // Dispose previous provider if it exists
    if (disposableRef.current) {
      disposableRef.current.dispose();
    }

    // Register SQL completion provider
    const disposable = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', ',', '(', '='],
      provideCompletionItems: async (model: any, position: any) => {
        try {
          // Get the latest schemas if the callback is provided
          let currentSchemas = tableSchemas;

          if (getLatestSchemas) {
            const latest = getLatestSchemas();
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
          const keywords = [...DUCKDB_KEYWORDS, ...customKeywords];
          const functions = [...DUCKDB_FUNCTIONS, ...customFunctions];

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
            if (connector) {
              const functionSuggestions = await getFunctionSuggestions(
                connector,
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

          return {
            suggestions,
          };
        } catch (error) {
          console.error('Error in SQL completion provider:', error);
          return {suggestions: []};
        }
      },
    });

    // Store the disposable to clean up later
    disposableRef.current = disposable;
  }, [customKeywords, customFunctions, tableSchemas, getLatestSchemas]);

  // Re-register completion provider when tableSchemas change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      registerCompletionProvider();
    }
  }, [tableSchemas, registerCompletionProvider]);

  // Handle editor mounting to configure SQL language features
  const handleEditorDidMount = useCallback<OnMount>(
    (editor, monaco) => {
      // Store references
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register SQL language if not already registered
      if (
        !monaco.languages.getLanguages().some((lang: any) => lang.id === 'sql')
      ) {
        monaco.languages.register({id: 'sql'});
      }

      // Combine keywords and functions with custom ones
      const keywords = [...DUCKDB_KEYWORDS, ...customKeywords];
      const functions = [...DUCKDB_FUNCTIONS, ...customFunctions];

      // Set the language configuration
      monaco.languages.setMonarchTokensProvider('sql', {
        ...SQL_LANGUAGE_CONFIGURATION,
        keywords,
        builtinFunctions: functions,
      } as any); // Using 'as any' to bypass the type checking issue

      // Register the completion provider
      registerCompletionProvider();

      // Store the disposable to clean up later if needed
      editor.onDidDispose(() => {
        if (disposableRef.current) {
          disposableRef.current.dispose();
        }
      });

      // Call the original onMount if provided
      if (onMount) {
        onMount(editor, monaco);
      }
    },
    [customKeywords, customFunctions, onMount, registerCompletionProvider],
  );

  return (
    <MonacoEditor
      language="sql"
      onMount={handleEditorDidMount}
      className={cn('h-full', className)}
      options={{
        formatOnPaste: true,
        formatOnType: true,
        wordWrap: 'on',
      }}
      {...props}
    />
  );
};
