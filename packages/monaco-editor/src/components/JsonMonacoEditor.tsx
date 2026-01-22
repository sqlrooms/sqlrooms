import React from 'react';
import {MonacoEditor, MonacoEditorProps} from './MonacoEditor';
import {OnMount} from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

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
  ...props
}) => {
  // JSON tokenizer registration is a GLOBAL side-effect. Keep it scoped to JsonMonacoEditor
  // (not the generic MonacoEditor wrapper) and only register once.
  const ensureJsonTokenizerDefined = (monaco: typeof Monaco) => {
    const g = globalThis as any;
    if (g.__sqlrooms_json_tokenizer_defined__) return;
    g.__sqlrooms_json_tokenizer_defined__ = true;

    monaco.languages.setMonarchTokensProvider('json', {
      tokenizer: {
        root: [
          // Property keys (strings followed by a colon)
          [/"([^"]*)"(?=\\s*:)/, 'string.key.json'],

          // Regular string values (any quoted string not followed by a colon)
          [/"([^"]*)"(?!\\s*:)/, 'string.value.json'],

          // Numbers (integers, decimals, and scientific notation)
          [/-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?/, 'number'],

          // Keywords
          [/\\b(?:true|false|null)\\b/, 'keyword'],

          // Punctuation and delimiters
          [/[{}[\\],:]/, 'delimiter'],
        ],
      },
    });
  };

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
      console.log('formatting document');
      editor.getAction('editor.action.formatDocument')?.run();
    }, 100);

    // Call the original onMount if provided
    if (onMount) {
      onMount(editor, monaco);
    }
  };

  return (
    <MonacoEditor
      language="json"
      value={stringValue}
      beforeMount={(monaco) => {
        ensureJsonTokenizerDefined(monaco as unknown as typeof Monaco);
        beforeMount?.(monaco);
      }}
      onMount={handleEditorDidMount}
      className={className}
      options={{
        formatOnPaste: true,
        formatOnType: true,
      }}
      {...props}
    />
  );
};
