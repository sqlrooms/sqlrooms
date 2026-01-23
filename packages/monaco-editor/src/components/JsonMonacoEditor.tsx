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

    // Open suggestions immediately when a quote is typed (opening a JSON string).
    let suggestScheduled = false;
    const changeDisposable = editor.onDidChangeModelContent(
      (e: Monaco.editor.IModelContentChangedEvent) => {
        if (
          (e as any).isFlush ||
          (e as any).isUndoing ||
          (e as any).isRedoing
        ) {
          return;
        }
        if (!editor.hasTextFocus?.()) return;

        // Only trigger when a quote was inserted (opening a JSON string; Monaco may auto-close
        // and insert `""` in one edit).
        const insertedQuote = e.changes.some((c) => c.text.includes('"'));
        if (!insertedQuote) return;

        if (suggestScheduled) return;
        suggestScheduled = true;
        requestAnimationFrame(() => {
          suggestScheduled = false;
          editor.trigger('sqlrooms', 'editor.action.triggerSuggest', {});
        });
      },
    );

    // Call the original onMount if provided
    if (onMount) {
      onMount(editor, monaco);
    }

    editor.onDidDispose(() => changeDisposable.dispose());
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
        // Word-based suggestions from existing content in this editor:
        // typing inside quotes should suggest previously used strings like "q", "fff", "sddd", etc.
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
