import React from 'react';
import {MonacoEditor, MonacoEditorProps} from './MonacoEditor';
import {OnMount} from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

// Ensure Monaco's JSON language service is registered (completions, schema-based suggestions, etc).
import 'monaco-editor/esm/vs/language/json/monaco.contribution';

export interface JsonMonacoEditorProps extends Omit<
  MonacoEditorProps,
  'language' | 'value'
> {
  /**
   * The JSON schema to validate against
   */
  schema?: object;
  /**
   * The JSON value to edit
   */
  value?: string | object;
}

/**
 * A Monaco editor for editing JSON with schema validation
 */
export const JsonMonacoEditor: React.FC<JsonMonacoEditorProps> = ({
  schema,
  value = '',
  onMount,
  className,
  beforeMount,
  options: userOptions,
  ...props
}) => {
  // Convert object value to string if needed
  const stringValue =
    typeof value === 'object' ? JSON.stringify(value, null, 2) : value;

  // Handle editor mounting to configure JSON schema
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    if (schema) {
      // Configure JSON schema validation
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [
          {
            uri: 'http://myserver/schema.json',
            fileMatch: ['*'],
            schema: schema as any,
          },
        ],
      });
    }

    // Format the document on initial load
    setTimeout(() => {
      editor.getAction('editor.action.formatDocument')?.run();
    }, 100);

    // Auto-trigger suggestions when user types a quote character.
    let pendingSuggestRaf: number | null = null;
    const autoSuggestPopupTrigger = editor.onDidChangeModelContent(
      (e: Monaco.editor.IModelContentChangedEvent) => {
        // Skip programmatic changes, undo/redo, and full model replacements to avoid unnecessary triggers.
        if (
          (e as any).isFlush ||
          (e as any).isUndoing ||
          (e as any).isRedoing
        ) {
          return;
        }

        // Check if the change included one or more quote characters (e.g., typing `"` or Monaco auto-inserting `""`).
        const insertedQuote = e.changes.some((c) => /^"+$/.test(c.text));
        if (!insertedQuote) return;

        // Defer trigger to Monaco's next animation frame to avoid re-renders
        pendingSuggestRaf = requestAnimationFrame(() => {
          pendingSuggestRaf = null;
          try {
            // Preferred: use editor.trigger API for programmatic command invocation.
            editor.trigger('sqlrooms', 'editor.action.triggerSuggest', {});
          } catch {
            // Fallback: if trigger API fails (rare), invoke the action directly.
            editor.getAction('editor.action.triggerSuggest')?.run();
          }
        });
      },
    );

    // Invoke caller's onMount callback after our setup is complete.
    if (onMount) {
      onMount(editor, monaco);
    }

    // Clean up the content listener and any pending RAF when the editor is disposed.
    editor.onDidDispose(() => {
      autoSuggestPopupTrigger.dispose();
      if (pendingSuggestRaf !== null) {
        cancelAnimationFrame(pendingSuggestRaf);
        pendingSuggestRaf = null;
      }
    });
  };

  return (
    <MonacoEditor
      language="json"
      value={stringValue}
      beforeMount={beforeMount}
      onMount={handleEditorDidMount}
      className={className}
      options={{
        formatOnPaste: true,
        formatOnType: true,
        wordBasedSuggestions: 'currentDocument' as any,
        wordBasedSuggestionsOnlySameLanguage: true,
        suggest: {showWords: true} as any,
        quickSuggestions: {other: true, comments: false, strings: true} as any,
        suggestOnTriggerCharacters: true,
        ...userOptions,
      }}
      {...props}
    />
  );
};
